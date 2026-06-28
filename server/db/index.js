import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'app.sqlite'));
db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf-8'));

export function hashContent(content) {
  return createHash('sha256').update(content || '').digest('hex');
}

// ---------- Settings ----------
export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value);
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ---------- Competitors ----------
export function listCompetitors(status) {
  if (status) {
    return db
      .prepare('SELECT * FROM competitors WHERE status = ? ORDER BY name COLLATE NOCASE')
      .all(status);
  }
  return db.prepare('SELECT * FROM competitors ORDER BY name COLLATE NOCASE').all();
}

export function getCompetitor(id) {
  return db.prepare('SELECT * FROM competitors WHERE id = ?').get(id);
}

export function getCompetitorByPricingUrl(url) {
  return db.prepare('SELECT * FROM competitors WHERE pricing_url = ?').get(url);
}

// Insert; if the pricing_url already exists, return the existing row instead of throwing.
export function upsertCompetitor({ name, website, pricing_url, notes, source = 'manual', status = 'pending' }) {
  const existing = getCompetitorByPricingUrl(pricing_url);
  if (existing) return existing;
  const info = db
    .prepare(
      `INSERT INTO competitors (name, website, pricing_url, notes, source, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, website || null, pricing_url, notes || null, source, status);
  return getCompetitor(info.lastInsertRowid);
}

export function updateCompetitorStatus(id, status) {
  db.prepare('UPDATE competitors SET status = ? WHERE id = ?').run(status, id);
  return getCompetitor(id);
}

export function setCompetitorChecked(id, { error = null, changed = false } = {}) {
  db.prepare(
    `UPDATE competitors
       SET last_checked_at = datetime('now'),
           last_error = ?,
           last_changed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE last_changed_at END
     WHERE id = ?`
  ).run(error, changed ? 1 : 0, id);
  return getCompetitor(id);
}

export function deleteCompetitor(id) {
  db.prepare('DELETE FROM competitors WHERE id = ?').run(id);
}

// ---------- Snapshots ----------
export function getLatestSnapshot(competitorId) {
  return db
    .prepare('SELECT * FROM snapshots WHERE competitor_id = ? ORDER BY fetched_at DESC, id DESC LIMIT 1')
    .get(competitorId);
}

export function listSnapshots(competitorId) {
  return db
    .prepare('SELECT id, competitor_id, content_hash, fetched_at FROM snapshots WHERE competitor_id = ? ORDER BY fetched_at DESC, id DESC')
    .all(competitorId);
}

export function getSnapshot(id) {
  return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
}

export function insertSnapshot(competitorId, content) {
  const content_hash = hashContent(content);
  const info = db
    .prepare('INSERT INTO snapshots (competitor_id, content, content_hash) VALUES (?, ?, ?)')
    .run(competitorId, content, content_hash);
  return getSnapshot(info.lastInsertRowid);
}

// ---------- Changes ----------
export function insertChange({ competitor_id, snapshot_id, prev_snapshot_id, diff, summary, analysis }) {
  const info = db
    .prepare(
      `INSERT INTO changes (competitor_id, snapshot_id, prev_snapshot_id, diff, summary, analysis)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      competitor_id,
      snapshot_id,
      prev_snapshot_id || null,
      diff,
      summary || null,
      analysis ? JSON.stringify(analysis) : null
    );
  return db.prepare('SELECT * FROM changes WHERE id = ?').get(info.lastInsertRowid);
}

export function listChanges(competitorId) {
  return db
    .prepare('SELECT * FROM changes WHERE competitor_id = ? ORDER BY detected_at DESC, id DESC')
    .all(competitorId);
}

// Recent changes across all competitors, joined with competitor name.
export function listRecentChanges(limit = 50) {
  return db
    .prepare(
      `SELECT c.*, comp.name AS competitor_name
         FROM changes c
         JOIN competitors comp ON comp.id = c.competitor_id
        ORDER BY c.detected_at DESC, c.id DESC
        LIMIT ?`
    )
    .all(limit);
}

export function countUnseenChanges() {
  return db.prepare('SELECT COUNT(*) AS n FROM changes WHERE seen = 0').get().n;
}

export function markChangesSeen() {
  db.prepare('UPDATE changes SET seen = 1 WHERE seen = 0').run();
}

export default db;
