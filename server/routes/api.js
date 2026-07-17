import { Router } from 'express';
import {
  listCompetitors,
  getCompetitor,
  getCompetitorByPricingUrl,
  upsertCompetitor,
  updateCompetitorStatus,
  deleteCompetitor,
  listSnapshots,
  getLatestSnapshot,
  getSnapshot,
  listChanges,
  listRecentChanges,
  countUnseenChanges,
  markChangesSeen,
  getAllSettings,
  setSetting,
  getSetting,
} from '../db/index.js';
import { discoverCompetitors } from '../agents/discoveryAgent.js';
import { refreshCompetitor, refreshAll } from '../agents/monitor.js';
import { getKey, setKey } from '../services/keys.js';
import { sendPushToWorkspace } from '../services/push.js';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { METHODOLOGY } from '../services/marketInsights.js';

const router = Router();

// Small async wrapper so route handlers can throw.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parseAnalysis(change) {
  let analysis = null;
  try {
    analysis = change.analysis ? JSON.parse(change.analysis) : null;
  } catch {
    /* ignore */
  }
  return { ...change, analysis };
}

function normalizeUrl(u) {
  if (!u) return null;
  const t = u.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

function normalizeWebhookUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    const slack = url.hostname === 'hooks.slack.com' && url.pathname.startsWith('/services/');
    const discord = ['discord.com', 'discordapp.com'].includes(url.hostname) && url.pathname.startsWith('/api/webhooks/');
    return url.protocol === 'https:' && (slack || discord) ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------- Health / keys (public) ----------
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

router.get('/methodology', (_req, res) => {
  res.json({ methodology: METHODOLOGY });
});

// Everything below requires a valid session and a workspace the user belongs to.
router.use(requireAuth, resolveWorkspace);

// ---------- Discovery ----------
// Body: { mode, description, productUrl, competitorUrls: [] }
// mode is informational; behavior is driven by which fields are present.
router.post(
  '/discover',
  wrap(async (req, res) => {
    const { description, productUrl, competitorUrls } = req.body || {};

    const manualUrls = (Array.isArray(competitorUrls) ? competitorUrls : [])
      .map(normalizeUrl)
      .filter(Boolean);

    // Direct competitor URLs become immediate candidates (no discovery needed).
    const directCandidates = manualUrls.map((url) => ({
      name: hostname(url),
      website: originOf(url),
      pricing_url: url,
      notes: 'Added directly',
    }));

    let market = (description || '').trim();
    let discovered = [];

    // Run discovery if we have a description or product URL to work from.
    if (description?.trim() || productUrl?.trim()) {
      const result = await discoverCompetitors({
        description,
        productUrl: normalizeUrl(productUrl),
      });
      market = result.market;
      discovered = result.candidates;
    }

    // Merge, de-duping by pricing_url (direct URLs win).
    const seen = new Set(directCandidates.map((c) => c.pricing_url.toLowerCase()));
    const candidates = [...directCandidates];
    for (const c of discovered) {
      if (seen.has(c.pricing_url.toLowerCase())) continue;
      seen.add(c.pricing_url.toLowerCase());
      candidates.push(c);
    }

    res.json({ market, candidates });
  })
);

// ---------- Competitors ----------
router.get(
  '/competitors',
  wrap(async (req, res) => {
    const competitors = await listCompetitors(req.query.status, req.workspaceId);
    const enriched = await Promise.all(
      competitors.map(async (c) => ({
        ...c,
        changeCount: (await listChanges(c.id)).length,
        hasSnapshot: Boolean(await getLatestSnapshot(c.id)),
      }))
    );
    res.json({ competitors: enriched });
  })
);

// Bulk add approved competitors (typically from the discovery approval screen).
// Body: { competitors: [{ name, website, pricing_url, notes }], status }
router.post(
  '/competitors',
  wrap(async (req, res) => {
    const incoming = Array.isArray(req.body?.competitors)
      ? req.body.competitors
      : [req.body].filter(Boolean);
    const status = req.body?.status || 'approved';

    const added = [];
    for (const c of incoming) {
      const pricing_url = normalizeUrl(c.pricing_url || c.url);
      if (!pricing_url) continue;
      const before = await getCompetitorByPricingUrl(pricing_url, req.workspaceId).catch(() => null);
      const row = await upsertCompetitor({
        name: (c.name || hostname(pricing_url)).trim(),
        website: normalizeUrl(c.website) || originOf(pricing_url),
        pricing_url,
        notes: c.notes || null,
        source: c.source || 'discovered',
        status,
        workspace_id: req.workspaceId || null,
      });
      added.push(row);
      // Fire new-competitor push only for genuinely new approved rows.
      if (!before && row && status === 'approved' && req.workspaceId) {
        sendPushToWorkspace(
          req.workspaceId,
          {
            title: `New competitor: ${row.name}`,
            body: 'Added to your watchlist.',
            url: `/competitors/${row.id}`,
            tag: `competitor-${row.id}`,
          },
          'new-competitor'
        ).catch(() => {});
      }
    }
    res.json({ added });
  })
);

router.get(
  '/competitors/:id',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id, req.workspaceId);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const [latest, snapshots, changes] = await Promise.all([
      getLatestSnapshot(competitor.id),
      listSnapshots(competitor.id),
      listChanges(competitor.id),
    ]);
    res.json({
      competitor,
      latestSnapshot: latest || null,
      snapshots,
      changes: changes.map(parseAnalysis),
    });
  })
);

router.patch(
  '/competitors/:id',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id, req.workspaceId);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const { status } = req.body || {};
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const wasPending = competitor.status === 'pending';
    const updated = status ? await updateCompetitorStatus(competitor.id, status, req.workspaceId) : competitor;
    if (wasPending && status === 'approved' && (competitor.workspace_id || req.workspaceId)) {
      sendPushToWorkspace(
        competitor.workspace_id || req.workspaceId,
        {
          title: `New competitor: ${updated.name}`,
          body: 'Approved and added to your watchlist.',
          url: `/competitors/${updated.id}`,
          tag: `competitor-${updated.id}`,
        },
        'new-competitor'
      ).catch(() => {});
    }
    res.json({ competitor: updated });
  })
);

router.delete(
  '/competitors/:id',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id, req.workspaceId);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    await deleteCompetitor(competitor.id, req.workspaceId);
    res.json({ ok: true });
  })
);

router.get(
  '/competitors/:id/snapshots/:snapshotId',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id, req.workspaceId);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const snap = await getSnapshot(req.params.snapshotId);
    if (!snap || String(snap.competitor_id) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ snapshot: snap });
  })
);

// ---------- Refresh ----------
router.post(
  '/competitors/:id/refresh',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id, req.workspaceId);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const result = await refreshCompetitor(competitor);
    res.json({ result, competitor: await getCompetitor(competitor.id, req.workspaceId) });
  })
);

router.post(
  '/refresh',
  wrap(async (req, res) => {
    const competitors = await listCompetitors('approved', req.workspaceId);
    if (!competitors.length) return res.json({ results: [] });
    const results = await refreshAll(competitors, null, req.workspaceId);
    res.json({ results });
  })
);

// ---------- Changes / notifications ----------
router.get(
  '/changes',
  wrap(async (req, res) => {
    const [changes, unseen] = await Promise.all([
      listRecentChanges(Number(req.query.limit) || 50, req.workspaceId),
      countUnseenChanges(req.workspaceId),
    ]);
    res.json({ changes: changes.map(parseAnalysis), unseen });
  })
);

router.get(
  '/changes/unseen-count',
  wrap(async (req, res) => {
    res.json({ unseen: await countUnseenChanges(req.workspaceId) });
  })
);

router.post(
  '/changes/mark-seen',
  wrap(async (req, res) => {
    await markChangesSeen(req.workspaceId);
    res.json({ ok: true, unseen: 0 });
  })
);

// ---------- Settings ----------
router.get(
  '/settings',
  wrap(async (req, res) => {
    const all = await getAllSettings(req.workspaceId);
    for (const name of ['YOUCOM_API_KEY', 'XAI_API_KEY', 'XAI_MODEL']) {
      if (all[`key:${name}`]) setKey(name, all[`key:${name}`], req.workspaceId);
    }
    res.json({
      webhook_url: all.webhook_url || '',
      market: all.market || '',
      last_visit: all.last_visit || null,
      auto_refresh_enabled: (process.env.AUTO_REFRESH_ENABLED ?? 'true') !== 'false',
      insforge_base_url: process.env.INSFORGE_BASE_URL || '',
      // Never return the secrets themselves — only whether they're configured.
      youcom_key_set: Boolean(getKey('YOUCOM_API_KEY', req.workspaceId)),
      xai_key_set: Boolean(getKey('XAI_API_KEY', req.workspaceId)),
      xai_model: getKey('XAI_MODEL', req.workspaceId) || 'grok-4',
    });
  })
);

router.put(
  '/settings',
  wrap(async (req, res) => {
    const { webhook_url, market, youcom_api_key, xai_api_key, xai_model } = req.body || {};
    if (webhook_url !== undefined) {
      const normalizedWebhook = normalizeWebhookUrl(webhook_url);
      if (normalizedWebhook === null) {
        return res.status(400).json({ error: 'Use a valid Slack or Discord HTTPS webhook URL.' });
      }
      await setSetting('webhook_url', normalizedWebhook, req.workspaceId);
    }
    if (market !== undefined) await setSetting('market', market || '', req.workspaceId);
    // Only update keys when a non-empty value is provided, so leaving the field
    // blank keeps the existing key (the client never receives it back).
    if (youcom_api_key) {
      await setSetting('key:YOUCOM_API_KEY', youcom_api_key, req.workspaceId);
      setKey('YOUCOM_API_KEY', youcom_api_key, req.workspaceId);
    }
    if (xai_api_key) {
      await setSetting('key:XAI_API_KEY', xai_api_key, req.workspaceId);
      setKey('XAI_API_KEY', xai_api_key, req.workspaceId);
    }
    if (xai_model !== undefined) {
      await setSetting('key:XAI_MODEL', xai_model, req.workspaceId);
      setKey('XAI_MODEL', xai_model, req.workspaceId);
    }
    res.json({ ok: true });
  })
);

// Record the time of the user's visit (used to compute "new since last visit").
router.post(
  '/visit',
  wrap(async (req, res) => {
    const prev = await getSetting('last_visit', null, req.workspaceId);
    await setSetting('last_visit', new Date().toISOString(), req.workspaceId);
    res.json({ previous_visit: prev });
  })
);

// ---------- helpers ----------
function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default router;
