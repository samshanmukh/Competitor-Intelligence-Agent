// Exercises the PostgREST-shaped query builder against a real Postgres engine
// (PGlite — the same server code compiled to WASM), using the production
// schema.sql. These tests mirror the exact call shapes used in server/db/*.js,
// server/services/*.js and server/routes/*.js, so a regression here means a
// regression in the app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createDatabaseClient } from '../server/db/pgClient.js';

const schemaPath = fileURLToPath(new URL('../server/db/schema.sql', import.meta.url));

const pglite = new PGlite();
await pglite.exec(await readFile(schemaPath, 'utf8'));

// PGlite reports `affectedRows`; `pg` reports `rowCount`. The client only needs
// `{ rows, rowCount }`.
// `.database` is the namespace the app uses: `databaseClient.database.from(...)`.
const db = createDatabaseClient(async (sql, params) => {
  const result = await pglite.query(sql, params);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
}).database;

/** Fresh workspace per test so ordering and counts stay deterministic. */
let seq = 0;
async function newWorkspace() {
  seq += 1;
  const { data } = await db
    .from('workspaces')
    .insert({ name: `WS ${seq}`, slug: `ws-${seq}`, owner_id: `user-${seq}`, plan: 'free' })
    .select()
    .maybeSingle();
  return data;
}

test('schema applies and creates every table the app reads', async () => {
  const { rows } = await pglite.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const tables = rows.map((r) => r.table_name).sort();
  for (const expected of [
    'changes', 'competitors', 'jobs', 'market_model_history', 'market_models',
    'products', 'push_subscriptions', 'reports', 'settings', 'snapshots',
    'workspace_members', 'workspaces',
  ]) {
    assert.ok(tables.includes(expected), `missing table: ${expected}`);
  }
});

test('insert().select().maybeSingle() returns the created row', async () => {
  const ws = await newWorkspace();
  assert.ok(Number.isFinite(ws.id));
  assert.equal(ws.plan, 'free');
  // Timestamps come back as normalized ISO strings.
  assert.match(ws.created_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('mutation without .select() resolves to no data but still writes', async () => {
  const ws = await newWorkspace();
  const result = await db
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: 'u1', role: 'admin' });
  assert.equal(result.error, null);
  assert.equal(result.data, null);

  const { data } = await db
    .from('workspace_members')
    .select()
    .eq('workspace_id', ws.id)
    .maybeSingle();
  assert.equal(data.user_id, 'u1');
});

test('maybeSingle() yields null rather than throwing when nothing matches', async () => {
  const { data, error } = await db
    .from('competitors')
    .select()
    .eq('id', 999999)
    .maybeSingle();
  assert.equal(error, null);
  assert.equal(data, null);
});

test('embedded select resolves workspace_members -> workspaces', async () => {
  const ws = await newWorkspace();
  await db.from('workspace_members').insert({ workspace_id: ws.id, user_id: 'owner-x', role: 'admin' });

  // Exactly the shape getUserWorkspaces() issues.
  const { data } = await db
    .from('workspace_members')
    .select('role, workspace_id, workspaces(id, name, slug, plan, created_at)')
    .eq('user_id', 'owner-x');

  assert.equal(data.length, 1);
  assert.equal(data[0].role, 'admin');
  assert.equal(data[0].workspaces.id, ws.id);
  assert.equal(data[0].workspaces.slug, ws.slug);
  // The mapping in getUserWorkspaces() depends on these keys existing.
  assert.deepEqual(
    Object.keys(data[0].workspaces).sort(),
    ['created_at', 'id', 'name', 'plan', 'slug']
  );

  // Embedded columns arrive as jsonb, which bypasses pg's timestamptz parser.
  // They must still be ISO UTC, matching what a top-level timestamp returns.
  assert.match(
    data[0].workspaces.created_at,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    `embedded timestamp not normalized to ISO UTC: ${data[0].workspaces.created_at}`
  );
  assert.equal(
    new Date(data[0].workspaces.created_at).getTime(),
    new Date(ws.created_at).getTime(),
    'embedded timestamp lost precision or shifted the instant'
  );
});

test('a jsonb column the app owns is not timestamp-rewritten', async () => {
  const ws = await newWorkspace();
  // market_models.data is application JSON; strings inside it that happen to
  // look like timestamps must round-trip untouched.
  const payload = { inputs: { as_of: '2026-08-21T16:58:58.05-08:00' }, tam: { value_usd: 1 } };
  await db.from('market_models').upsert({ workspace_id: ws.id, data: payload });

  const { data } = await db
    .from('market_models')
    .select('data')
    .eq('workspace_id', ws.id)
    .maybeSingle();

  assert.equal(data.data.inputs.as_of, '2026-08-21T16:58:58.05-08:00');
});

test('embedded select resolves changes -> competitors alongside *', async () => {
  const ws = await newWorkspace();
  const { data: comp } = await db
    .from('competitors')
    .insert({ name: 'Acme', pricing_url: 'https://acme.test/pricing', workspace_id: ws.id })
    .select()
    .maybeSingle();
  const { data: snap } = await db
    .from('snapshots')
    .insert({ competitor_id: comp.id, content: 'x', content_hash: 'h' })
    .select()
    .maybeSingle();
  await db
    .from('changes')
    .insert({ competitor_id: comp.id, snapshot_id: snap.id, diff: 'd', summary: 's' });

  // The shape listRecentChanges() issues.
  const { data } = await db
    .from('changes')
    .select('*, competitors(name, workspace_id)')
    .order('detected_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50);

  const row = data.find((r) => r.competitor_id === comp.id);
  assert.ok(row, 'inserted change not returned');
  assert.equal(row.competitors.name, 'Acme');
  assert.equal(row.competitors.workspace_id, ws.id);
  assert.equal(row.diff, 'd');       // `*` still expands base columns
  assert.equal(row.seen, false);     // schema default
});

test('upsert() on settings updates in place rather than duplicating', async () => {
  const key = 'workspace:1:webhook_url';
  await db.from('settings').upsert({ key, value: 'first', updated_at: new Date().toISOString() });
  await db.from('settings').upsert({ key, value: 'second', updated_at: new Date().toISOString() });

  const { data } = await db.from('settings').select('value').eq('key', key).maybeSingle();
  assert.equal(data.value, 'second');

  const { rows } = await pglite.query('SELECT count(*)::int AS n FROM settings WHERE key = $1', [key]);
  assert.equal(rows[0].n, 1);
});

test('update().eq().select().maybeSingle() returns the updated row', async () => {
  const ws = await newWorkspace();
  const { data: comp } = await db
    .from('competitors')
    .insert({ name: 'Beta', pricing_url: 'https://beta.test/p', workspace_id: ws.id })
    .select()
    .maybeSingle();

  const { data } = await db
    .from('competitors')
    .update({ status: 'approved' })
    .eq('id', comp.id)
    .eq('workspace_id', ws.id)
    .select()
    .maybeSingle();

  assert.equal(data.status, 'approved');
});

test('count with head:true returns a count and no rows', async () => {
  const ws = await newWorkspace();
  const { data: comp } = await db
    .from('competitors')
    .insert({ name: 'Gamma', pricing_url: 'https://gamma.test/p', workspace_id: ws.id })
    .select()
    .maybeSingle();
  const { data: snap } = await db
    .from('snapshots').insert({ competitor_id: comp.id, content: 'c' }).select().maybeSingle();
  await db.from('changes').insert({ competitor_id: comp.id, snapshot_id: snap.id, diff: 'd' });

  // countUnseenChanges()'s global branch.
  const { count, data } = await db
    .from('changes')
    .select('id', { count: 'exact', head: true })
    .eq('seen', false);

  assert.equal(data, null);
  assert.ok(count >= 1, `expected at least one unseen change, got ${count}`);
});

test('in() filters by a list and short-circuits on empty input', async () => {
  const ws = await newWorkspace();
  const { data: comp } = await db
    .from('competitors')
    .insert({ name: 'Delta', pricing_url: 'https://delta.test/p', workspace_id: ws.id })
    .select()
    .maybeSingle();
  const { data: snap } = await db
    .from('snapshots').insert({ competitor_id: comp.id, content: 'c' }).select().maybeSingle();
  const { data: change } = await db
    .from('changes')
    .insert({ competitor_id: comp.id, snapshot_id: snap.id, diff: 'd' })
    .select()
    .maybeSingle();

  // markChangesSeen()'s workspace-scoped branch.
  await db.from('changes').update({ seen: true }).in('id', [change.id]);
  const { data: after } = await db.from('changes').select('seen').eq('id', change.id).maybeSingle();
  assert.equal(after.seen, true);

  const { data: none, error } = await db.from('changes').select().in('id', []);
  assert.equal(error, null);
  assert.deepEqual(none, []);
});

test('ordering honours ascending:false across multiple keys', async () => {
  const ws = await newWorkspace();
  const { data: comp } = await db
    .from('competitors')
    .insert({ name: 'Eps', pricing_url: 'https://eps.test/p', workspace_id: ws.id })
    .select()
    .maybeSingle();

  const stamp = '2026-01-01T00:00:00.000Z';
  for (const n of [1, 2, 3]) {
    await db.from('snapshots').insert({
      competitor_id: comp.id, content: `c${n}`, content_hash: `h${n}`, fetched_at: stamp,
    });
  }

  // getLatestSnapshot(): same fetched_at, so the id tiebreak decides.
  const { data } = await db
    .from('snapshots')
    .select()
    .eq('competitor_id', comp.id)
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  assert.equal(data.content, 'c3');
});

test('delete().eq() removes only the matching rows', async () => {
  const ws = await newWorkspace();
  await db.from('push_subscriptions').insert({
    user_id: 'u-del', workspace_id: ws.id,
    subscription: JSON.stringify({ endpoint: 'https://push.test/1' }),
    alert_types: JSON.stringify(['any']),
  });
  const { data: subs } = await db.from('push_subscriptions').select().eq('user_id', 'u-del');
  assert.equal(subs.length, 1);

  await db.from('push_subscriptions').delete().eq('id', subs[0].id);
  const { data: after } = await db.from('push_subscriptions').select().eq('user_id', 'u-del');
  assert.deepEqual(after, []);
});

test('jsonb round-trips as a structured object for market models', async () => {
  const ws = await newWorkspace();
  const model = { tam: { value_usd: 1_000_000 }, sam: { value_usd: 100 }, inputs: { geography: 'US' } };
  await db.from('market_models').insert({ workspace_id: ws.id, data: model });

  const { data } = await db.from('market_models').select().eq('workspace_id', ws.id).maybeSingle();
  assert.equal(data.data.tam.value_usd, 1_000_000);
  assert.equal(data.data.inputs.geography, 'US');
});

test('text id primary key works for jobs', async () => {
  await db.from('jobs').insert({ id: 'abc123', type: 'market', status: 'running' });
  await db.from('jobs').update({ status: 'done', result: JSON.stringify({ n: 1 }) }).eq('id', 'abc123');

  const { data } = await db.from('jobs').select().eq('id', 'abc123').maybeSingle();
  assert.equal(data.status, 'done');
  assert.deepEqual(JSON.parse(data.result), { n: 1 });
});

test('eq(col, null) becomes IS NULL', async () => {
  const { data, error } = await db.from('competitors').select().eq('workspace_id', null);
  assert.equal(error, null);
  assert.ok(Array.isArray(data));
});

test('a failing query resolves with an error instead of rejecting', async () => {
  const { data, error, status } = await db.from('competitors').select('no_such_column');
  assert.equal(data, null);
  assert.ok(error, 'expected an error object');
  assert.equal(status, 500);
  assert.match(error.message, /no_such_column/);
});

test('unsafe identifiers are rejected', async () => {
  const { error } = await db.from('competitors').select('id; DROP TABLE competitors');
  assert.ok(error, 'expected the injection attempt to be refused');
  assert.match(error.message, /Unsafe SQL identifier/);
});

test('undeclared embedded relationships are refused', async () => {
  const { error } = await db.from('competitors').select('*, workspaces(id)');
  assert.match(error.message, /No declared relationship competitors -> workspaces/);
});

test('workspace uniqueness constraint on (workspace_id, pricing_url) holds', async () => {
  const ws = await newWorkspace();
  const url = 'https://dup.test/pricing';
  await db.from('competitors').insert({ name: 'One', pricing_url: url, workspace_id: ws.id });
  const { error } = await db
    .from('competitors')
    .insert({ name: 'Two', pricing_url: url, workspace_id: ws.id });
  assert.ok(error, 'duplicate pricing_url in the same workspace should fail');

  // ...but the same URL is fine in a different workspace.
  const other = await newWorkspace();
  const { error: crossError } = await db
    .from('competitors')
    .insert({ name: 'Three', pricing_url: url, workspace_id: other.id });
  assert.equal(crossError, null);
});

test.after(() => pglite.close());
