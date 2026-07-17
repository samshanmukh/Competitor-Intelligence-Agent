// Orchestrates a refresh for one competitor: fetch -> diff -> analyze -> store -> alert.

import { fetchCompetitor } from './fetchAgent.js';
import { buildDiff, analyzeDiff } from './analysisAgent.js';
import { insertChange, setCompetitorChecked, getCompetitor } from '../db/index.js';
import { sendWebhook } from '../services/alerts.js';
import { sendPushToWorkspace } from '../services/push.js';
import { pushNotification } from '../services/workspaceStore.js';
import { getWorkspaceJson } from '../services/workspaceStore.js';

/**
 * Refresh a single competitor. Returns a result describing what happened.
 * status: 'changed' | 'unchanged' | 'first_snapshot' | 'error'
 */
export async function refreshCompetitor(competitor) {
  const result = await fetchCompetitor(competitor);

  if (!result.ok) {
    await setCompetitorChecked(competitor.id, { error: result.error });
    return { id: competitor.id, name: competitor.name, status: 'error', error: result.error };
  }

  if (result.unchanged) {
    await setCompetitorChecked(competitor.id, { error: null, changed: false });
    return { id: competitor.id, name: competitor.name, status: 'unchanged' };
  }

  const { snapshot, previous } = result;

  // First snapshot for this competitor — nothing to diff against yet.
  if (!previous) {
    await setCompetitorChecked(competitor.id, { error: null, changed: false });
    return { id: competitor.id, name: competitor.name, status: 'first_snapshot', snapshotId: snapshot.id };
  }

  const diff = buildDiff(previous.content, snapshot.content, competitor.name);
  const analysis = await analyzeDiff({ competitorName: competitor.name, diff });

  const change = await insertChange({
    competitor_id: competitor.id,
    snapshot_id: snapshot.id,
    prev_snapshot_id: previous.id,
    diff,
    summary: analysis.summary,
    analysis,
  });

  await setCompetitorChecked(competitor.id, { error: null, changed: true });

  // Fire-and-await the webhook but never let it fail the refresh.
  let webhook = null;
  try {
    webhook = await sendWebhook(change, competitor);
  } catch {
    webhook = { sent: false };
  }

  // Send web push notifications to the workspace (never let it fail the refresh).
  if (competitor.workspace_id) {
    try {
      await sendPushToWorkspace(
        competitor.workspace_id,
        {
          title: `${competitor.name} changed pricing`,
          body: analysis.summary || 'A pricing change was detected.',
          url: `/competitors/${competitor.id}`,
          tag: `change-${change.id}`,
        },
        analysis.impact === 'high' ? 'high-impact' : 'any'
      );
      await pushNotification(competitor.workspace_id, {
        type: 'pricing-change',
        title: `${competitor.name} changed pricing`,
        body: analysis.summary || 'A pricing change was detected.',
        url: `/competitors/${competitor.id}`,
        impact: analysis.impact,
      });

      // Watchlist threshold: notify if AI flagged a price drop above threshold.
      const alerts = await getWorkspaceJson(competitor.workspace_id, 'watchlist-alerts', { enabled: true, thresholdPct: 10 });
      const drop = Number(analysis.price_drop_pct || analysis.max_price_drop_pct || 0);
      if (alerts?.enabled && drop >= (alerts.thresholdPct || 10)) {
        await sendPushToWorkspace(
          competitor.workspace_id,
          {
            title: `${competitor.name} price drop ≥${alerts.thresholdPct}%`,
            body: analysis.summary || `Detected ~${drop}% drop.`,
            url: `/competitors/${competitor.id}`,
            tag: `drop-${change.id}`,
          },
          'high-impact'
        );
      }
    } catch (err) {
      console.warn('[push] notification failed:', err.message);
    }
  }

  return {
    id: competitor.id,
    name: competitor.name,
    status: 'changed',
    changeId: change.id,
    summary: analysis.summary,
    impact: analysis.impact,
    webhook,
  };
}

/**
 * Refresh many competitors sequentially (the You.com client serializes calls
 * anyway, and sequential keeps us rate-limit friendly). Returns an array of results.
 */
export async function refreshAll(competitors, onProgress, workspaceId = null) {
  const results = [];
  for (let i = 0; i < competitors.length; i++) {
    const comp = (await getCompetitor(competitors[i].id, workspaceId)) || competitors[i];
    if (workspaceId != null && String(comp.workspace_id) !== String(workspaceId)) continue;
    const res = await refreshCompetitor(comp);
    results.push(res);
    if (onProgress) onProgress(res, i + 1, competitors.length);
  }
  return results;
}

export const monitor = { refreshCompetitor, refreshAll };
