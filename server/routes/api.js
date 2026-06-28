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
import { getKey, setKey } from '../services/keys.js';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';

const router = Router();

// Optional auth — sets req.user and req.workspaceId if token provided, but doesn't fail without it.
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  const token = authHeader.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const data = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      req.user = { id: data.sub, email: data.email };
    }
  } catch { /* ignore */ }
  const wsHeader = req.headers['x-workspace-id'];
  if (wsHeader) req.workspaceId = Number(wsHeader);
  next();
}

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

// Apply optional auth to all routes
router.use(optionalAuth);

// ---------- Health / keys ----------
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    youcom_key: Boolean(getKey('YOUCOM_API_KEY')),
    xai_key: Boolean(getKey('XAI_API_KEY')),
    model: getKey('XAI_MODEL') || 'grok-4',
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
      added.push(
        await upsertCompetitor({
          name: (c.name || hostname(pricing_url)).trim(),
          website: normalizeUrl(c.website) || originOf(pricing_url),
          pricing_url,
          notes: c.notes || null,
          source: c.source || 'discovered',
          status,
          workspace_id: req.workspaceId || null,
        })
      );
    }
    res.json({ added });
  })
);

router.get(
  '/competitors/:id',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id);
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
    const competitor = await getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const { status } = req.body || {};
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updated = status ? await updateCompetitorStatus(competitor.id, status) : competitor;
    res.json({ competitor: updated });
  })
);

router.delete(
  '/competitors/:id',
  wrap(async (req, res) => {
    const competitor = await getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    await deleteCompetitor(competitor.id);
    res.json({ ok: true });
  })
);

router.get(
  '/competitors/:id/snapshots/:snapshotId',
  wrap(async (req, res) => {
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
    const competitor = await getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Not found' });
    const result = await refreshCompetitor(competitor);
    res.json({ result, competitor: await getCompetitor(competitor.id) });
  })
);

router.post(
  '/refresh',
  wrap(async (req, res) => {
    const competitors = await listCompetitors('approved');
    if (!competitors.length) return res.json({ results: [] });
    const results = await refreshAll(competitors);
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
    const all = await getAllSettings();
    res.json({
      webhook_url: all.webhook_url || '',
      market: all.market || '',
      last_visit: all.last_visit || null,
      auto_refresh_enabled: (process.env.AUTO_REFRESH_ENABLED ?? 'true') !== 'false',
      // API keys — from in-memory cache (DB-saved or env-loaded)
      youcom_api_key: getKey('YOUCOM_API_KEY') || '',
      xai_api_key: getKey('XAI_API_KEY') || '',
      xai_model: getKey('XAI_MODEL') || 'grok-4',
      insforge_base_url: process.env.INSFORGE_BASE_URL || 'https://tpq6mvqe.us-east.insforge.app',
      insforge_anon_key: process.env.INSFORGE_ANON_KEY || 'anon_b6023a1adec5472cfe335ee7fec1139a85bd05a43a2f0513e2eba963c4a71d1f',
    });
  })
);

router.put(
  '/settings',
  wrap(async (req, res) => {
    const { webhook_url, market, youcom_api_key, xai_api_key, xai_model } = req.body || {};
    if (webhook_url !== undefined) await setSetting('webhook_url', normalizeUrl(webhook_url) || '');
    if (market !== undefined) await setSetting('market', market || '');
    if (youcom_api_key !== undefined) {
      await setSetting('key:YOUCOM_API_KEY', youcom_api_key);
      setKey('YOUCOM_API_KEY', youcom_api_key);
    }
    if (xai_api_key !== undefined) {
      await setSetting('key:XAI_API_KEY', xai_api_key);
      setKey('XAI_API_KEY', xai_api_key);
    }
    if (xai_model !== undefined) {
      await setSetting('key:XAI_MODEL', xai_model);
      setKey('XAI_MODEL', xai_model);
    }
    res.json({ ok: true });
  })
);

// Record the time of the user's visit (used to compute "new since last visit").
router.post(
  '/visit',
  wrap(async (req, res) => {
    const prev = await getSetting('last_visit');
    await setSetting('last_visit', new Date().toISOString());
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
