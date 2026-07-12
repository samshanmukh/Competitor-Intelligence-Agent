// Workspace-scoped JSON blobs stored in the settings table (no new migrations).
import { getSetting, setSetting } from '../db/index.js';

export function wsKey(workspaceId, name) {
  return `ws:${workspaceId}:${name}`;
}

export async function getWorkspaceJson(workspaceId, name, fallback = null) {
  const raw = await getSetting(wsKey(workspaceId, name));
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function setWorkspaceJson(workspaceId, name, value) {
  await setSetting(wsKey(workspaceId, name), JSON.stringify(value));
  return value;
}

export async function appendWorkspaceList(workspaceId, name, item, { max = 100 } = {}) {
  const list = (await getWorkspaceJson(workspaceId, name, [])) || [];
  const next = [item, ...list].slice(0, max);
  await setWorkspaceJson(workspaceId, name, next);
  return next;
}

export async function trackUsage(workspaceId, event, meta = {}) {
  const usage = (await getWorkspaceJson(workspaceId, 'usage', { events: [], totals: {} })) || { events: [], totals: {} };
  usage.totals[event] = (usage.totals[event] || 0) + 1;
  usage.events = [{ at: new Date().toISOString(), event, ...meta }, ...(usage.events || [])].slice(0, 200);
  await setWorkspaceJson(workspaceId, 'usage', usage);
  return usage;
}

export async function pushNotification(workspaceId, notification) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    read: false,
    ...notification,
  };
  await appendWorkspaceList(workspaceId, 'notifications', item, { max: 100 });
  return item;
}
