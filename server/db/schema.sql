-- Competitor Pricing Intelligence Agent — SQLite schema
-- Snapshots are append-only; change rows capture diffs + Claude analysis between snapshots.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitors (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  website      TEXT,
  pricing_url  TEXT    NOT NULL,
  notes        TEXT,                          -- short reason/description from discovery
  source       TEXT    NOT NULL DEFAULT 'manual', -- 'discovered' | 'manual'
  status       TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  last_checked_at  TEXT,                       -- ISO timestamp of most recent fetch attempt
  last_changed_at  TEXT,                       -- ISO timestamp of most recent detected change
  last_error   TEXT,                           -- last fetch error message, if any
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_pricing_url ON competitors(pricing_url);

CREATE TABLE IF NOT EXISTS snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  content       TEXT    NOT NULL,             -- clean Markdown from You.com Contents API
  content_hash  TEXT    NOT NULL,             -- hash of content for fast equality checks
  fetched_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_competitor ON snapshots(competitor_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS changes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_id     INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  snapshot_id       INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  prev_snapshot_id  INTEGER REFERENCES snapshots(id) ON DELETE SET NULL,
  diff              TEXT    NOT NULL,         -- unified diff text
  summary           TEXT,                     -- Claude's headline summary
  analysis          TEXT,                     -- Claude's structured analysis (JSON string)
  seen              INTEGER NOT NULL DEFAULT 0,
  detected_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_changes_competitor ON changes(competitor_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_changes_seen ON changes(seen);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
