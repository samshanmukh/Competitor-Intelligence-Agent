import { Router } from 'express';
import {
  listCompetitors,
  getCompetitor,
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

// ---------- Health / keys ----------
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    youcom_key: Boolean(process.env.YOUCOM_API_KEY),
    xai_key: Boolean(process.env.XAI_API_KEY),
    model: process.env.XAI_MODEL || 'grok-4',
  });
});

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
  wrap((req, res) => {
    const competitors = listCompetitors(req.query.status).map((c) => ({
      ...c,
      changeCount: listChanges(c.id).length,
      hasSnapshot: Boolean(getLatestSnapshot(c.id)),
    }));
    res.json({ competitors });
  })
);

// Bulk add approved competitors (typically from the discovery approval screen).
// Body: { competitors: [{ name, website, pricing_url, notes }], status }
router.post(
  '/competitors',
  wrap((req, res) => {
    const incoming = Array.isArray(req.body?.competitors)
      ? req.body.competitors
      : [req.body].filter(Boolean);
    const status = req.body?.status || 'approved';

    const added = [];
    for (const c of incoming) {
      const pricing_url = normalizeUrl(c.pricing_url || c.url);
      if (!pricing_url) continue;
      added.push(
        upsertCompetitor({
          name: (c.name || hostname(pricing_url)).trim(),
          website: normalizeUrl(c.website) || originOf(pricing_url),
          pricing_url,
          notes: c.notes || null,
          source: c.source || 'discovered',
          status,
        })
      );
    }
    res.json({ added });
  })
);

router.get(
  '/competitors/:id',
  wrap((req, res) => {
    const competitor = getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const latest = getLatestSnapshot(competitor.id);
    res.json({
      competitor,
      latestSnapshot: latest || null,
      snapshots: listSnapshots(competitor.id),
      changes: listChanges(competitor.id).map(parseAnalysis),
    });
  })
);

router.patch(
  '/competitors/:id',
  wrap((req, res) => {
    const competitor = getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const { status } = req.body || {};
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updated = status ? updateCompetitorStatus(competitor.id, status) : competitor;
    res.json({ competitor: updated });
  })
);

router.delete(
  '/competitors/:id',
  wrap((req, res) => {
    const competitor = getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    deleteCompetitor(competitor.id);
    res.json({ ok: true });
  })
);

router.get(
  '/competitors/:id/snapshots/:snapshotId',
  wrap((req, res) => {
    const snap = getSnapshot(req.params.snapshotId);
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
    const competitor = getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const result = await refreshCompetitor(competitor);
    res.json({ result, competitor: getCompetitor(competitor.id) });
  })
);

router.post(
  '/refresh',
  wrap(async (req, res) => {
    const competitors = listCompetitors('approved');
    if (!competitors.length) return res.json({ results: [] });
    const results = await refreshAll(competitors);
    res.json({ results });
  })
);

// ---------- Changes / notifications ----------
router.get(
  '/changes',
  wrap((req, res) => {
    res.json({
      changes: listRecentChanges(Number(req.query.limit) || 50).map(parseAnalysis),
      unseen: countUnseenChanges(),
    });
  })
);

router.get(
  '/changes/unseen-count',
  wrap((req, res) => {
    res.json({ unseen: countUnseenChanges() });
  })
);

router.post(
  '/changes/mark-seen',
  wrap((req, res) => {
    markChangesSeen();
    res.json({ ok: true, unseen: 0 });
  })
);

// ---------- Settings ----------
router.get(
  '/settings',
  wrap((req, res) => {
    const all = getAllSettings();
    res.json({
      webhook_url: all.webhook_url || '',
      market: all.market || '',
      last_visit: all.last_visit || null,
      auto_refresh_enabled: (process.env.AUTO_REFRESH_ENABLED ?? 'true') !== 'false',
    });
  })
);

router.put(
  '/settings',
  wrap((req, res) => {
    const { webhook_url, market } = req.body || {};
    if (webhook_url !== undefined) setSetting('webhook_url', normalizeUrl(webhook_url) || '');
    if (market !== undefined) setSetting('market', market || '');
    res.json({ ok: true });
  })
);

// Record the time of the user's visit (used to compute "new since last visit").
router.post(
  '/visit',
  wrap((req, res) => {
    const prev = getSetting('last_visit');
    setSetting('last_visit', new Date().toISOString());
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
