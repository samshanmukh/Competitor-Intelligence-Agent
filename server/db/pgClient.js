// A minimal PostgREST-shaped query builder over plain SQL.
//
// The app uses a small PostgREST-shaped query surface:
// `db.from('t').select('a, b').eq('x', 1).order('y').limit(3).maybeSingle()`.
// Rewriting all ~60 call sites into raw SQL would have been a large, silent
// behaviour-change risk, so instead this module reimplements the slice of that
// surface the app actually uses and executes it against Postgres. The call
// sites are untouched.
//
// Deliberately *not* a general PostgREST implementation — only the operators
// this codebase calls are supported. Anything else throws loudly at build time
// rather than silently returning wrong rows.
//
// Driver-agnostic: takes an `execute(sql, params) -> { rows, rowCount }`
// function, so it runs on `pg` in production and on an in-process Postgres in
// tests.

// ---------- Relationships ----------
// PostgREST resolves embedded selects (`competitors(name)`) from foreign keys.
// We declare the two the app relies on explicitly; an unknown embed throws.
const RELATIONS = {
  workspace_members: {
    workspaces: { column: 'workspace_id', table: 'workspaces', references: 'id' },
  },
  changes: {
    competitors: { column: 'competitor_id', table: 'competitors', references: 'id' },
  },
};

// Conflict targets for `.upsert()`. Defaults to the `id` primary key.
const UPSERT_CONFLICT = {
  settings: ['key'],
  market_models: ['workspace_id'],
  workspace_members: ['workspace_id', 'user_id'],
};

// ---------- Identifier safety ----------
// Every identifier here originates from a string literal in our own source, but
// validating keeps a future dynamic column name from becoming an injection.
const IDENT = /^[a-z_][a-z0-9_]*$/i;

function ident(name) {
  const trimmed = String(name).trim();
  if (!IDENT.test(trimmed)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${trimmed}"`;
}

/** Split "a, b, rel(x, y)" on top-level commas only. */
function splitFields(spec) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of spec) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Normalize PostgreSQL Date values to ISO strings for API responses. */
function normalize(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Columns inside an embedded join arrive as jsonb, so `pg` never runs its
// timestamptz parser on them — they come back as Postgres' own text rendering
// in the session timezone ("2026-08-21T16:58:58.05-08:00") rather than the ISO
// UTC string used by the API. Rewrite those back to ISO UTC so embedded and
// top-level timestamps agree.
const PG_TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:\d{2})?|Z)$/;

function normalizeEmbedded(value) {
  if (Array.isArray(value)) return value.map(normalizeEmbedded);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) out[key] = normalizeEmbedded(inner);
    return out;
  }
  if (typeof value === 'string' && PG_TIMESTAMPTZ.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return value;
}

function normalizeRow(row, embedNames = []) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    // Only declared embeds get the deep pass — a jsonb column the app owns
    // (market_models.data) must round-trip byte-for-byte.
    out[key] = embedNames.includes(key) ? normalizeEmbedded(value) : normalize(value);
  }
  return out;
}

class QueryBuilder {
  constructor(execute, table) {
    this.execute = execute;
    this.table = table;
    this.op = 'select';
    this.columns = ['*'];
    this.embeds = [];
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
    this.payload = null;
    this.wantsSingle = false;
    this.countMode = null;
    this.headOnly = false;
    this.returning = false;
  }

  // ---------- Projection ----------

  select(spec = '*', options = {}) {
    // Called after insert/update, this requests a RETURNING clause rather than
    // a projection; the resulting row shape is identical either way.
    if (this.op !== 'select') this.returning = true;

    if (options.count) this.countMode = options.count;
    if (options.head) this.headOnly = true;

    const fields = splitFields(spec);
    const plain = [];
    for (const field of fields) {
      const embed = field.match(/^([a-z_][a-z0-9_]*)\s*\((.*)\)$/i);
      if (embed) {
        const [, name, inner] = embed;
        // Validated in buildProjection() rather than here, so a bad relation
        // and a bad identifier both surface the same way: as `{ error }` on
        // the awaited result, never as a synchronous throw.
        this.embeds.push({ name, columns: splitFields(inner) });
      } else {
        plain.push(field);
      }
    }
    this.columns = plain.length ? plain : (this.embeds.length ? [] : ['*']);
    return this;
  }

  // ---------- Mutations ----------

  insert(values) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  update(values) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  upsert(values) {
    this.op = 'upsert';
    this.payload = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  // ---------- Filters / modifiers ----------

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orders.push({ column, ascending });
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.wantsSingle = true;
    this.limitCount = this.limitCount ?? 1;
    return this;
  }

  // ---------- SQL construction ----------

  buildWhere(params) {
    if (!this.filters.length) return '';
    const clauses = this.filters.map((filter) => {
      if (filter.type === 'in') {
        if (!filter.values.length) return 'FALSE';
        const slots = filter.values.map((value) => {
          params.push(value);
          return `$${params.length}`;
        });
        return `${ident(filter.column)} IN (${slots.join(', ')})`;
      }
      if (filter.value === null) return `${ident(filter.column)} IS NULL`;
      params.push(filter.value);
      return `${ident(filter.column)} = $${params.length}`;
    });
    return ` WHERE ${clauses.join(' AND ')}`;
  }

  buildProjection() {
    const base = this.columns.length
      ? this.columns.map((c) => (c === '*' ? `${ident(this.table)}.*` : ident(c)))
      : [];
    // Each embed becomes a correlated scalar subquery returning a JSON object
    // (or NULL), which is exactly the shape PostgREST produces.
    const embedded = this.embeds.map(({ name, columns }) => {
      const relation = RELATIONS[this.table]?.[name];
      if (!relation) {
        throw new Error(`No declared relationship ${this.table} -> ${name}`);
      }
      const inner = columns.map((c) => (c === '*' ? '*' : ident(c))).join(', ');
      return `(
        SELECT to_jsonb(sub) FROM (
          SELECT ${inner} FROM ${ident(relation.table)}
          WHERE ${ident(relation.table)}.${ident(relation.references)}
              = ${ident(this.table)}.${ident(relation.column)}
        ) sub
      ) AS ${ident(name)}`;
    });
    const all = [...base, ...embedded];
    return all.length ? all.join(', ') : '*';
  }

  buildOrderLimit(params) {
    let sql = '';
    if (this.orders.length) {
      const parts = this.orders.map(
        (o) => `${ident(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`
      );
      sql += ` ORDER BY ${parts.join(', ')}`;
    }
    if (this.limitCount != null) {
      params.push(this.limitCount);
      sql += ` LIMIT $${params.length}`;
    }
    return sql;
  }

  toSql() {
    const params = [];

    if (this.op === 'select') {
      if (this.headOnly && this.countMode) {
        return {
          sql: `SELECT count(*)::int AS count FROM ${ident(this.table)}${this.buildWhere(params)}`,
          params,
        };
      }
      const sql =
        `SELECT ${this.buildProjection()} FROM ${ident(this.table)}` +
        this.buildWhere(params) +
        this.buildOrderLimit(params);
      return { sql, params };
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const entries = Object.entries(this.payload);
      const cols = entries.map(([key]) => ident(key));
      const slots = entries.map(([, value]) => {
        params.push(value);
        return `$${params.length}`;
      });
      let sql = `INSERT INTO ${ident(this.table)} (${cols.join(', ')}) VALUES (${slots.join(', ')})`;
      if (this.op === 'upsert') {
        const conflict = UPSERT_CONFLICT[this.table] || ['id'];
        const updates = entries
          .filter(([key]) => !conflict.includes(key))
          .map(([key]) => `${ident(key)} = EXCLUDED.${ident(key)}`);
        sql += ` ON CONFLICT (${conflict.map(ident).join(', ')}) DO ${
          updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'
        }`;
      }
      // Only ask for rows back when the caller chained .select(); otherwise a
      // bulk update would needlessly stream large TEXT columns home.
      if (this.returning) sql += ` RETURNING ${this.buildProjection()}`;
      return { sql, params };
    }

    if (this.op === 'update') {
      const assignments = Object.entries(this.payload).map(([key, value]) => {
        params.push(value);
        return `${ident(key)} = $${params.length}`;
      });
      const sql =
        `UPDATE ${ident(this.table)} SET ${assignments.join(', ')}` +
        this.buildWhere(params) +
        (this.returning ? ` RETURNING ${this.buildProjection()}` : '');
      return { sql, params };
    }

    if (this.op === 'delete') {
      const sql = `DELETE FROM ${ident(this.table)}${this.buildWhere(params)}`;
      return { sql, params };
    }

    throw new Error(`Unsupported operation: ${this.op}`);
  }

  // ---------- Execution ----------

  async run() {
    const { sql, params } = this.toSql();
    const result = await this.execute(sql, params);
    const embedNames = this.embeds.map((e) => e.name);
    const rows = (result.rows || []).map((row) => normalizeRow(row, embedNames));

    if (this.headOnly && this.countMode) {
      return { data: null, error: null, status: 200, count: rows[0]?.count ?? 0 };
    }

    // A mutation without .select() resolves like PostgREST's minimal
    // representation: no rows, no error.
    if (this.op !== 'select' && !this.returning) {
      return { data: null, error: null, status: 200, count: result.rowCount ?? null };
    }

    if (this.wantsSingle) {
      return { data: rows.length ? rows[0] : null, error: null, status: 200, count: rows.length };
    }
    return { data: rows, error: null, status: 200, count: rows.length };
  }

  // Thenable so `await builder` works. It resolves with `{ data, error }`
  // instead of rejecting. `unwrap()` in
  // db/index.js is what turns an error into a throw.
  then(onFulfilled, onRejected) {
    return this.run()
      .catch((err) => ({
        data: null,
        count: null,
        status: statusFor(err),
        error: {
          error: codeFor(err),
          message: err.message,
          detail: err.detail ?? null,
        },
      }))
      .then(onFulfilled, onRejected);
  }
}

// Postgres connection-level failures (host down, auth rejected, DB missing)
// map to DB_UNAVAILABLE so the API reports an outage rather than a 500.
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH',
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '3D000', // invalid_catalog_name
  '57P03', // cannot_connect_now
  '08006', '08001', '08004', // connection failures
]);

function codeFor(err) {
  if (UNAVAILABLE_CODES.has(err.code)) return 'DB_UNAVAILABLE';
  return err.code || 'DB_ERROR';
}

function statusFor(err) {
  return UNAVAILABLE_CODES.has(err.code) ? 503 : 500;
}

/**
 * Build a client exposing the repository's `.database.from(table)` query shape.
 */
export function createDatabaseClient(execute) {
  return {
    database: {
      from(table) {
        return new QueryBuilder(execute, table);
      },
    },
  };
}

export { RELATIONS, UPSERT_CONFLICT, splitFields };
