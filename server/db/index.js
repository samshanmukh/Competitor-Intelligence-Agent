import { createClient } from '@insforge/sdk';
import { createHash } from 'node:crypto';

const baseUrl = process.env.INSFORGE_BASE_URL;
const anonKey = process.env.INSFORGE_ANON_KEY;
if (!baseUrl || !anonKey) {
  throw new Error('INSFORGE_BASE_URL and INSFORGE_ANON_KEY are required');
}

const insforge = createClient({
  baseUrl,
  anonKey,
});

export function hashContent(content) {
  return createHash('sha256').update(content || '').digest('hex');
}

// ---------- Settings ----------
function scopedSettingKey(key, workspaceId) {
  return workspaceId == null ? key : `workspace:${workspaceId}:${key}`;
}

export async function getSetting(key, fallback = null, workspaceId = null) {
  const { data } = await insforge.database
    .from('settings')
    .select('value')
    .eq('key', scopedSettingKey(key, workspaceId))
    .maybeSingle();
  return data ? data.value : fallback;
}

export async function setSetting(key, value, workspaceId = null) {
  await insforge.database
    .from('settings')
    .upsert({ key: scopedSettingKey(key, workspaceId), value, updated_at: new Date().toISOString() });
}

export async function getAllSettings(workspaceId = null) {
  const { data } = await insforge.database.from('settings').select('key, value');
  const prefix = workspaceId == null ? '' : `workspace:${workspaceId}:`;
  const rows = workspaceId == null
    ? (data || []).filter((r) => !r.key.startsWith('workspace:'))
    : (data || []).filter((r) => r.key.startsWith(prefix));
  return Object.fromEntries(rows.map((r) => [r.key.slice(prefix.length), r.value]));
}

// ---------- Competitors ----------
export async function listCompetitors(status, workspaceId) {
  let query = insforge.database.from('competitors').select().order('name', { ascending: true });
  if (status) query = query.eq('status', status);
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data } = await query;
  return data || [];
}

export async function getCompetitor(id, workspaceId = null) {
  let query = insforge.database.from('competitors').select().eq('id', id);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  const { data } = await query.maybeSingle();
  return data;
}

export async function getCompetitorByPricingUrl(url, workspaceId = null) {
  let query = insforge.database.from('competitors').select().eq('pricing_url', url);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  const { data } = await query.maybeSingle();
  return data;
}

export async function upsertCompetitor({ name, website, pricing_url, notes, source = 'manual', status = 'pending', workspace_id = null }) {
  const existing = await getCompetitorByPricingUrl(pricing_url, workspace_id);
  if (existing) return existing;
  const { data } = await insforge.database
    .from('competitors')
    .insert({ name, website: website || null, pricing_url, notes: notes || null, source, status, workspace_id })
    .select()
    .maybeSingle();
  return data;
}

export async function updateCompetitorStatus(id, status, workspaceId = null) {
  let query = insforge.database
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
  let query = insforge.database
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
  const { data } = await insforge.database
    .from('competitors')
    .update(updateData)
    .eq('id', id)
    .select()
    .maybeSingle();
  return data;
}

export async function deleteCompetitor(id, workspaceId = null) {
  let query = insforge.database.from('competitors').delete().eq('id', id);
  if (workspaceId != null) query = query.eq('workspace_id', workspaceId);
  await query;
}

// ---------- Snapshots ----------
export async function getLatestSnapshot(competitorId) {
  const { data } = await insforge.database
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
  const { data } = await insforge.database
    .from('snapshots')
    .select('id, competitor_id, content_hash, fetched_at')
    .eq('competitor_id', competitorId)
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false });
  return data || [];
}

export async function getSnapshot(id) {
  const { data } = await insforge.database.from('snapshots').select().eq('id', id).maybeSingle();
  return data;
}

export async function insertSnapshot(competitorId, content, source = null) {
  const content_hash = hashContent(content);
  const { data } = await insforge.database
    .from('snapshots')
    .insert({ competitor_id: competitorId, content, content_hash, source })
    .select()
    .maybeSingle();
  return data;
}

// ---------- Changes ----------
export async function insertChange({ competitor_id, snapshot_id, prev_snapshot_id, diff, summary, analysis }) {
  const { data } = await insforge.database
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
  const { data } = await insforge.database
    .from('changes')
    .select()
    .eq('competitor_id', competitorId)
    .order('detected_at', { ascending: false })
    .order('id', { ascending: false });
  return data || [];
}

export async function listRecentChanges(limit = 50, workspaceId = null) {
  let query = insforge.database
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
    const { count } = await insforge.database
      .from('changes')
      .select('id', { count: 'exact', head: true })
      .eq('seen', false);
    return count || 0;
  }
  const { data } = await insforge.database
    .from('changes')
    .select('*, competitors(workspace_id)')
    .eq('seen', false);
  return (data || []).filter((c) => c.competitors?.workspace_id == workspaceId).length;
}

export async function markChangesSeen(workspaceId = null) {
  if (!workspaceId) {
    await insforge.database.from('changes').update({ seen: true }).eq('seen', false);
    return;
  }
  const { data } = await insforge.database
    .from('changes')
    .select('id, competitors(workspace_id)')
    .eq('seen', false);
  const ids = (data || [])
    .filter((c) => c.competitors?.workspace_id == workspaceId)
    .map((c) => c.id);
  if (ids.length) {
    await insforge.database.from('changes').update({ seen: true }).in('id', ids);
  }
}

export default insforge;
