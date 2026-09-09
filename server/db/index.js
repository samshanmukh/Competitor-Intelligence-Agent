import pg from 'pg';
import { createHash } from 'node:crypto';
import { createDatabaseClient } from './pgClient.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required (PostgreSQL connection string)');
}

/**
 * Managed Postgres providers terminate TLS with certificates that aren't in
 * Node's default trust store, so verification is relaxed for remote hosts.
 * Private-network hostnames may have no dot and speak plaintext, and local
 * development needs no TLS at all.
 */
function sslFor(url) {
  if (/[?&]sslmode=disable\b/.test(url)) return false;
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { rejectUnauthorized: false };
  }
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const isPrivateHostname = !hostname.includes('.');
  return isLocal || isPrivateHostname ? false : { rejectUnauthorized: false };
}

const pool = new pg.Pool({
  connectionString,
  ssl: sslFor(connectionString),
  max: Number(process.env.PGPOOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// A dropped idle connection must not take the process down with it; the pool
// simply opens a fresh one on the next query.
pool.on('error', (err) => {
  console.warn('[db] idle client error:', err.message);
});

export { pool };

const databaseClient = createDatabaseClient((sql, params) => pool.query(sql, params));

export function hashContent(content) {
  return createHash('sha256').update(content || '').digest('hex');
}

// ---------- Error handling ----------
// The query builder resolves with `{ data, error }` instead of rejecting, so an
// unreachable database silently looks like "no rows". That turned every outage
// into a misleading downstream message ("Failed to create workspace"). `unwrap`
// surfaces the real reason instead.

export function isCredentialError(err) {
  return err?.code === 'DB_UNAVAILABLE';
}

/** Returns `result.data`, throwing a descriptive error when the driver reports one. */
export function unwrap(result, what = 'reading the database') {
  const raw = result?.error;
  if (!raw) return result?.data ?? null;

  const detail = raw.message || raw.error || `status ${result.status || '???'}`;
  const unavailable = raw.error === 'DB_UNAVAILABLE' || result?.status === 503;
  const err = new Error(
    unavailable
      ? `Database is unreachable while ${what} (${detail}). `
        + 'Check DATABASE_URL and that the Postgres instance is running.'
      : `Database error while ${what}: ${detail}`
  );
  err.code = unavailable ? 'DB_UNAVAILABLE' : 'DB_ERROR';
  err.status = unavailable ? 503 : 500;
  err.cause = raw;
  throw err;
}

/**
 * One cheap round-trip that proves the configured Postgres instance is
 * reachable and migrated. Returns `{ ok, error }` — never throws — so callers
 * can log or report it without taking the process down.
 */
export async function probeDatabase() {
  try {
    unwrap(
      await databaseClient.database.from('workspaces').select('id').limit(1),
      'checking database connectivity'
    );
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code || 'DB_ERROR' };
  }
}

// ---------- Settings ----------
function scopedSettingKey(key, workspaceId) {
  return workspaceId == null ? key : `workspace:${workspaceId}:${key}`;
}

export async function getSetting(key, fallback = null, workspaceId = null) {
  const { data } = await databaseClient.database
    .from('settings')
    .select('value')
    .eq('key', scopedSettingKey(key, workspaceId))
    .maybeSingle();
  return data ? data.value : fallback;
}

export async function setSetting(key, value, workspaceId = null) {
  await databaseClient.database
    .from('settings')
    .upsert({ key: scopedSettingKey(key, workspaceId), value, updated_at: new Date().toISOString() });
}

export async function getAllSettings(workspaceId = null) {
  const { data } = await databaseClient.database.from('settings').select('key, value');
  const prefix = workspaceId == null ? '' : `workspace:${workspaceId}:`;
  const rows = workspaceId == null
    ? (data || []).filter((r) => !r.key.startsWith('workspace:'))
    : (data || []).filter((r) => r.key.startsWith(prefix));
  return Object.fromEntries(rows.map((r) => [r.key.slice(prefix.length), r.value]));
}

// ---------- Competitors ----------
export async function listCompetitors(status, workspaceId) {
  let query = databaseClient.database.from('competitors').select().order('name', { ascending: true });
  if (status) query = query.eq('status', status);
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data } = await query;
  return data || [];
}

export async function getCompetitor(id, workspaceId = null) {
  let query = databaseClient.database.from('competitors').select().eq('id', id);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  const { data } = await query.maybeSingle();
  return data;
}

export async function getCompetitorByPricingUrl(url, workspaceId = null) {
  let query = databaseClient.database.from('competitors').select().eq('pricing_url', url);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  const { data } = await query.maybeSingle();
  return data;
}

export async function upsertCompetitor({ name, website, pricing_url, notes, source = 'manual', status = 'pending', workspace_id = null }) {
  const existing = await getCompetitorByPricingUrl(pricing_url, workspace_id);
  if (existing) return existing;
  const { data } = await databaseClient.database
    .from('competitors')
    .insert({ name, website: website || null, pricing_url, notes: notes || null, source, status, workspace_id })
    .select()
    .maybeSingle();
  return data;
}

export async function updateCompetitorStatus(id, status, workspaceId = null) {
  let query = databaseClient.database
    .from('competitors')
    .update({ status })
    .eq('id', id);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  const { data } = await query.select().maybeSingle();
  return data;
}

/** Persist a discovered App Store / Play Store URL as the pricing source. */
export async function updateCompetitorPricingUrl(id, pricing_url, workspaceId = null) {
  if (!id || !pricing_url) return null;
  let query = databaseClient.database
    .from('competitors')
    .update({ pricing_url })
    .eq('id', id);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  const { data } = await query.select().maybeSingle();
  return data;
}

export async function setCompetitorChecked(id, { error = null, changed = false } = {}) {
  const updateData = {
    last_checked_at: new Date().toISOString(),
    last_error: error ?? null,
  };
  if (changed) updateData.last_changed_at = new Date().toISOString();
  const { data } = await databaseClient.database
    .from('competitors')
    .update(updateData)
    .eq('id', id)
    .select()
    .maybeSingle();
  return data;
}

export async function deleteCompetitor(id, workspaceId = null) {
  let query = databaseClient.database.from('competitors').delete().eq('id', id);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  await query;
}

// ---------- Snapshots ----------
export async function getLatestSnapshot(competitorId) {
  const { data } = await databaseClient.database
    .from('snapshots')
    .select()
    .eq('competitor_id', competitorId)
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function listSnapshots(competitorId) {
  const { data } = await databaseClient.database
    .from('snapshots')
    .select('id, competitor_id, content_hash, fetched_at')
    .eq('competitor_id', competitorId)
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false });
  return data || [];
}

export async function getSnapshot(id) {
  const { data } = await databaseClient.database.from('snapshots').select().eq('id', id).maybeSingle();
  return data;
}

export async function insertSnapshot(competitorId, content, source = null) {
  const content_hash = hashContent(content);
  const { data } = await databaseClient.database
    .from('snapshots')
    .insert({ competitor_id: competitorId, content, content_hash, source })
    .select()
    .maybeSingle();
  return data;
}

// ---------- Changes ----------
export async function insertChange({ competitor_id, snapshot_id, prev_snapshot_id, diff, summary, analysis }) {
  const { data } = await databaseClient.database
    .from('changes')
    .insert({
      competitor_id,
      snapshot_id,
      prev_snapshot_id: prev_snapshot_id || null,
      diff,
      summary: summary || null,
      analysis: analysis ? JSON.stringify(analysis) : null,
    })
    .select()
    .maybeSingle();
  return data;
}

export async function listChanges(competitorId) {
  const { data } = await databaseClient.database
    .from('changes')
    .select()
    .eq('competitor_id', competitorId)
    .order('detected_at', { ascending: false })
    .order('id', { ascending: false });
  return data || [];
}

export async function listRecentChanges(limit = 50, workspaceId = null) {
  let query = databaseClient.database
    .from('changes')
    .select('*, competitors(name, workspace_id)')
    .order('detected_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  const { data } = await query;
  const rows = (data || []).map(({ competitors, ...rest }) => ({
    ...rest,
    competitor_name: competitors?.name ?? null,
  }));
  if (!workspaceId) return rows;
  return rows.filter((r) => {
    const comp = data?.find((d) => d.id === r.id);
    return comp?.competitors?.workspace_id == workspaceId;
  });
}

export async function countUnseenChanges(workspaceId = null) {
  if (!workspaceId) {
    const { count } = await databaseClient.database
      .from('changes')
      .select('id', { count: 'exact', head: true })
      .eq('seen', false);
    return count || 0;
  }
  const { data } = await databaseClient.database
    .from('changes')
    .select('*, competitors(workspace_id)')
    .eq('seen', false);
  return (data || []).filter((c) => c.competitors?.workspace_id == workspaceId).length;
}

export async function markChangesSeen(workspaceId = null) {
  if (!workspaceId) {
    await databaseClient.database.from('changes').update({ seen: true }).eq('seen', false);
    return;
  }
  const { data } = await databaseClient.database
    .from('changes')
    .select('id, competitors(workspace_id)')
    .eq('seen', false);
  const ids = (data || [])
    .filter((c) => c.competitors?.workspace_id == workspaceId)
    .map((c) => c.id);
  if (ids.length) {
    await databaseClient.database.from('changes').update({ seen: true }).in('id', ids);
  }
}

export default databaseClient;
