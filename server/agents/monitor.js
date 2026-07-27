// Orchestrates a refresh for one competitor: fetch -> diff -> analyze -> store -> alert.
// Always discovers App Store / Play Store listings and merges In-App Purchase prices.

import { fetchCompetitor } from './fetchAgent.js';
import { buildDiff, analyzeDiff } from './analysisAgent.js';
import {
  insertChange,
  setCompetitorChecked,
  getCompetitor,
  getLatestSnapshot,
  insertSnapshot,
  hashContent,
  updateCompetitorPricingUrl,
} from '../db/index.js';
import { sendWebhook } from '../services/alerts.js';
import { sendPushToWorkspace } from '../services/push.js';
import { pushNotification } from '../services/workspaceStore.js';
import { getWorkspaceJson } from '../services/workspaceStore.js';
import {
  enrichWithStorePricing,
  isStoreUrl,
  contentLooksLikeStorePricing,
  contentHasAppStoreIap,
} from '../services/storePricing.js';

/**
 * Discover store listings + IAP and merge into the snapshot content.
 * Runs for every refresh (not only when the website scrape fails).
 */
async function mergeStorePricing(competitor, webText = '', priorResult = null) {
  try {
    if (webText && contentHasAppStoreIap(webText) && priorResult?.ok) {
      return priorResult;
    }

    const enriched = await enrichWithStorePricing(competitor, webText);
    if (!enriched?.content) return priorResult?.ok ? priorResult : null;

    const content = enriched.content;
    const usable = /\$\s?\d/.test(content) || contentLooksLikeStorePricing(content);
    if (!usable) return priorResult?.ok ? priorResult : null;

    // Prefer store URL only when website scrape failed / had no prices.
    const webOk = priorResult?.ok && /\$\s?\d/.test(webText);
    const storeUrl = enriched.appStore || enriched.playStore;
    if (storeUrl && competitor.id && !isStoreUrl(competitor.pricing_url) && !webOk) {
      try {
        await updateCompetitorPricingUrl(competitor.id, storeUrl);
        competitor.pricing_url = storeUrl;
      } catch {
        /* non-fatal */
      }
    }

    if (!enriched.added && priorResult?.ok) return priorResult;

    const latest = await getLatestSnapshot(competitor.id);
    if (latest && latest.content_hash === hashContent(content)) {
      return { ok: true, unchanged: true, snapshot: latest };
    }

    const snapshot = await insertSnapshot(
      competitor.id,
      content,
      enriched.kind || (enriched.appStore ? 'app-store' : 'pricing_page')
    );
    return { ok: true, unchanged: false, snapshot, previous: latest || null };
  } catch (err) {
    console.warn(`[monitor] store enrich failed for ${competitor.name}:`, err.message);
    return priorResult?.ok ? priorResult : null;
  }
}

/**
 * Refresh a single competitor. Returns a result describing what happened.
 * status: 'changed' | 'unchanged' | 'first_snapshot' | 'error'
 */
export async function refreshCompetitor(competitor) {
  let result = await fetchCompetitor(competitor);
  const webText = result.ok ? (result.snapshot?.content || '') : '';

  // Always find App/Play Store + merge IAP prices when an app listing exists.
  const merged = await mergeStorePricing(competitor, webText, result);
  if (merged?.ok) {
    result = merged;
  } else if (!result.ok) {
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
