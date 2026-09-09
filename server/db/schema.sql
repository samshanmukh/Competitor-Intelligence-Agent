-- Competitor Intelligence Agent — Postgres schema.
--
-- Reconstructed from the application's own read/write call sites (every
-- `.insert()`, `.update()` and `.select()` in server/). Column types follow how
-- each value is produced and consumed in JS: ids the app compares with
-- `Number()` are integers, former external user ids are
-- opaque strings, and anything the app `JSON.parse()`s on read is stored as
-- text (not jsonb) so the round-trip stays byte-identical.
--
-- Idempotent: safe to re-run against an existing database.

BEGIN;

-- ---------- Tenancy ----------

CREATE TABLE IF NOT EXISTS workspaces (
  id             SERIAL PRIMARY KEY,
  name           TEXT        NOT NULL,
  slug           TEXT        NOT NULL UNIQUE,
  -- Auth-provider user id (opaque string), not a local FK.
  owner_id       TEXT        NOT NULL,
  plan           TEXT        NOT NULL DEFAULT 'free',
  digest_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  digest_email   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `user_id` also stores the `invited:<email>` sentinel used for pending
-- invites, so it is deliberately a plain string with no FK.
CREATE TABLE IF NOT EXISTS workspace_members (
  id            SERIAL PRIMARY KEY,
  workspace_id  INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'analyst',
  invited_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members (user_id);

-- ---------- Competitors ----------

CREATE TABLE IF NOT EXISTS competitors (
  id              SERIAL PRIMARY KEY,
  workspace_id    INTEGER     REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  website         TEXT,
  pricing_url     TEXT,
  notes           TEXT,
  source          TEXT        NOT NULL DEFAULT 'manual',
  status          TEXT        NOT NULL DEFAULT 'pending',
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  last_error      TEXT,
  value_score     DOUBLE PRECISION,
  value_analysis  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches 20260716_workspace_competitor_uniqueness.sql: a pricing URL is
-- unique per workspace, not globally.
CREATE UNIQUE INDEX IF NOT EXISTS competitors_workspace_pricing_url_key
  ON competitors (workspace_id, pricing_url);

CREATE INDEX IF NOT EXISTS competitors_workspace_id_idx ON competitors (workspace_id);

-- ---------- Monitoring ----------

CREATE TABLE IF NOT EXISTS snapshots (
  id            SERIAL PRIMARY KEY,
  competitor_id INTEGER     NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  content       TEXT,
  content_hash  TEXT,
  source        TEXT,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- getLatestSnapshot() orders by (fetched_at DESC, id DESC) per competitor.
CREATE INDEX IF NOT EXISTS snapshots_competitor_fetched_idx
  ON snapshots (competitor_id, fetched_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS changes (
  id               SERIAL PRIMARY KEY,
  competitor_id    INTEGER     NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  snapshot_id      INTEGER     REFERENCES snapshots(id) ON DELETE SET NULL,
  prev_snapshot_id INTEGER     REFERENCES snapshots(id) ON DELETE SET NULL,
  diff             TEXT,
  summary          TEXT,
  -- Written with JSON.stringify(), read back with JSON.parse().
  analysis         TEXT,
  seen             BOOLEAN     NOT NULL DEFAULT FALSE,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS changes_competitor_detected_idx
  ON changes (competitor_id, detected_at DESC, id DESC);

-- countUnseenChanges() / markChangesSeen() filter on seen = false.
CREATE INDEX IF NOT EXISTS changes_unseen_idx ON changes (seen) WHERE seen = FALSE;

-- ---------- Reports ----------

CREATE TABLE IF NOT EXISTS reports (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  -- Public share token (randomBytes(12).toString('hex')).
  token        TEXT        NOT NULL UNIQUE,
  content      TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_workspace_created_idx
  ON reports (workspace_id, created_at DESC);

-- ---------- Background jobs ----------

-- id is an app-generated hex string (randomBytes(8)), not a sequence.
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT        PRIMARY KEY,
  workspace_id INTEGER,
  user_id      TEXT,
  type         TEXT        NOT NULL DEFAULT 'job',
  status       TEXT        NOT NULL DEFAULT 'running',
  result       TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reconcileStaleJobs() sweeps status = 'running' on every boot.
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);

-- ---------- Web push ----------

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  workspace_id INTEGER     REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Both stored as JSON strings and JSON.parse()d on read.
  subscription TEXT        NOT NULL,
  alert_types  TEXT        NOT NULL DEFAULT '["any"]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_workspace_idx
  ON push_subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);

-- ---------- Settings ----------

-- Global rows use the bare key; per-workspace rows are prefixed by
-- scopedSettingKey() as `workspace:<id>:<key>`.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Product profile ----------

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'My Product',
  description  TEXT,
  pricing_url  TEXT,
  logo_url     TEXT,
  -- Free-text pricing notes, interpolated into prompts as a string.
  pricing_data TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- getProduct() takes the lowest-id row per workspace.
CREATE INDEX IF NOT EXISTS products_workspace_id_idx ON products (workspace_id, id);

-- ---------- Market model (TAM/SAM/SOM) ----------

-- One live model per workspace; `data` is read back as a structured object
-- (model.tam.value_usd, …) so it is jsonb rather than text.
CREATE TABLE IF NOT EXISTS market_models (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER     NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id   INTEGER     REFERENCES products(id) ON DELETE SET NULL,
  data         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit trail of every rebuild, newest first in the UI.
CREATE TABLE IF NOT EXISTS market_model_history (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id   INTEGER     REFERENCES products(id) ON DELETE SET NULL,
  data         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_model_history_workspace_created_idx
  ON market_model_history (workspace_id, created_at DESC);

COMMIT;
