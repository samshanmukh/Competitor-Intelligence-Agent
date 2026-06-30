import { createClient } from '@insforge/sdk';
import { createHash } from 'node:crypto';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || 'https://tpq6mvqe.us-east.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || 'anon_b6023a1adec5472cfe335ee7fec1139a85bd05a43a2f0513e2eba963c4a71d1f',
});

export function hashContent(content) {
  return createHash('sha256').update(content || '').digest('hex');
}

// ---------- Settings ----------
export async function getSetting(key, fallback = null) {
  const { data } = await insforge.database.from('settings').select('value').eq('key', key).maybeSingle();
  return data ? data.value : fallback;
}

export async function setSetting(key, value) {
  await insforge.database
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
}

export async function getAllSettings() {
  const { data } = await insforge.database.from('settings').select('key, value');
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

// ---------- Competitors ----------
export async function listCompetitors(status, workspaceId) {
  let query = insforge.database.from('competitors').select().order('name', { ascending: true });
  if (status) query = query.eq('status', status);
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data } = await query;
  return data || [];
}

export async function getCompetitor(id) {
  const { data } = await insforge.database.from('competitors').select().eq('id', id).maybeSingle();
  return data;
}

export async function getCompetitorByPricingUrl(url) {
  const { data } = await insforge.database.from('competitors').select().eq('pricing_url', url).maybeSingle();
  return data;
}

export async function upsertCompetitor({ name, website, pricing_url, notes, source = 'manual', status = 'pending', workspace_id = null }) {
  const existing = await getCompetitorByPricingUrl(pricing_url);
  if (existing) return existing;
  const { data } = await insforge.database
    .from('competitors')
    .insert({ name, website: website || null, pricing_url, notes: notes || null, source, status, workspace_id })
    .select()
    .maybeSingle();
  return data;
}

export async function updateCompetitorStatus(id, status) {
  const { data } = await insforge.database
    .from('competitors')
    .update({ status })
    .eq('id', id)
    .select()
    .maybeSingle();
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

export async function deleteCompetitor(id) {
  await insforge.database.from('competitors').delete().eq('id', id);
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

// ---------- Waitlist ----------
export async function addToWaitlist(email, { source = null, referrer = null } = {}) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return { ok: false, error: 'Email is required' };

  // Idempotent: if the email is already on the list, treat it as success.
  const { data: existing } = await insforge.database
    .from('waitlist')
    .select('id')
    .eq('email', clean)
    .maybeSingle();
  if (existing) return { ok: true, already: true };

  const { data, error } = await insforge.database
    .from('waitlist')
    .insert({ email: clean, source, referrer })
    .select()
    .maybeSingle();
  if (error) {
    // Unique-violation race → still a success from the user's perspective.
    if (/duplicate|unique/i.test(error.message || '')) return { ok: true, already: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, already: false, entry: data };
}

export async function countWaitlist() {
  const { count } = await insforge.database
    .from('waitlist')
    .select('id', { count: 'exact', head: true });
  return count || 0;
}

export default insforge;
