import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { completeJSON, complete } from '../services/ai.js';
import { listCompetitors, listRecentChanges, getSetting } from '../db/index.js';
import { getProduct } from '../db/products.js';
import {
  getWorkspaceJson,
  setWorkspaceJson,
  appendWorkspaceList,
  trackUsage,
  pushNotification,
} from '../services/workspaceStore.js';
import { distributionSnapshotKey } from '../services/marketDistribution.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, resolveWorkspace);

async function loadContext(workspaceId) {
  const [competitors, product, distributionRaw, changes] = await Promise.all([
    listCompetitors('approved', workspaceId),
    getProduct(workspaceId).catch(() => null),
    getSetting(distributionSnapshotKey(workspaceId)).catch(() => null),
    listRecentChanges(25, workspaceId).catch(() => []),
  ]);
  let distribution = null;
  try { distribution = distributionRaw ? JSON.parse(distributionRaw) : null; } catch { /* ignore */ }
  return { competitors: competitors || [], product, distribution, changes: changes || [] };
}

// ─── Notifications center ───────────────────────────────────────────────────
router.get('/notifications', wrap(async (req, res) => {
  const items = (await getWorkspaceJson(req.workspaceId, 'notifications', [])) || [];
  res.json({ notifications: items });
}));

router.post('/notifications/mark-read', wrap(async (req, res) => {
  const items = ((await getWorkspaceJson(req.workspaceId, 'notifications', [])) || []).map((n) => ({ ...n, read: true }));
  await setWorkspaceJson(req.workspaceId, 'notifications', items);
  res.json({ ok: true });
}));

// ─── Next moves brief ───────────────────────────────────────────────────────
router.post('/next-moves', wrap(async (req, res) => {
  const ctx = await loadContext(req.workspaceId);
  const brief = await completeJSON({
    system: `You are a startup strategy advisor. Return JSON:
{ "summary": string, "moves": [{ "priority": 1-5, "title": string, "why": string, "owner": "product"|"sales"|"marketing"|"founders", "effort": "S"|"M"|"L", "impact": "low"|"medium"|"high" }], "watchouts": string[] }
Prioritize concrete actions from competitive + market signals. Max 7 moves.`,
    user: JSON.stringify({
      product: ctx.product,
      competitors: ctx.competitors.map((c) => ({ name: c.name, notes: c.notes, last_changed_at: c.last_changed_at })),
      recentChanges: ctx.changes.slice(0, 10).map((c) => ({
        competitor: c.competitor_name || c.name,
        summary: (() => { try { return JSON.parse(c.analysis)?.summary; } catch { return null; } })(),
        impact: (() => { try { return JSON.parse(c.analysis)?.impact; } catch { return null; } })(),
      })),
      distribution: ctx.distribution ? {
        method: ctx.distribution.method,
        items: (ctx.distribution.items || []).slice(0, 8).map((i) => ({ name: i.name, share: i.share_pct || i.presence_pct })),
        shifts: ctx.distribution.pulse?.shifts?.slice?.(0, 5),
      } : null,
    }),
    maxTokens: 2000,
  });
  await trackUsage(req.workspaceId, 'next_moves');
  await pushNotification(req.workspaceId, {
    type: 'next-moves',
    title: 'Next moves brief ready',
    body: brief?.summary?.slice(0, 120) || 'Your weekly priorities were generated.',
    url: '/moves',
  });
  await setWorkspaceJson(req.workspaceId, 'next-moves-latest', { ...brief, generatedAt: new Date().toISOString() });
  res.json({ brief });
}));

router.get('/next-moves', wrap(async (req, res) => {
  const brief = await getWorkspaceJson(req.workspaceId, 'next-moves-latest', null);
  res.json({ brief });
}));

// ─── Win / loss intel ───────────────────────────────────────────────────────
router.get('/win-loss', wrap(async (req, res) => {
  const entries = (await getWorkspaceJson(req.workspaceId, 'win-loss', [])) || [];
  res.json({ entries });
}));

router.post('/win-loss', wrap(async (req, res) => {
  const { notes, outcome = 'unknown', competitor } = req.body || {};
  if (!notes?.trim()) return res.status(400).json({ error: 'notes required' });
  const ctx = await loadContext(req.workspaceId);
  const analysis = await completeJSON({
    system: `Analyze sales win/loss notes. Return JSON:
{ "outcome": "won"|"lost"|"unknown", "primaryCompetitor": string|null, "objections": string[], "talkTracks": string[], "battlecardUpdates": string[], "summary": string }`,
    user: JSON.stringify({
      notes,
      statedOutcome: outcome,
      statedCompetitor: competitor || null,
      knownCompetitors: ctx.competitors.map((c) => c.name),
      product: ctx.product?.name,
    }),
    maxTokens: 1500,
  });
  const entry = {
    id: `${Date.now()}`,
    at: new Date().toISOString(),
    notes: notes.trim(),
    outcome: analysis?.outcome || outcome,
    competitor: analysis?.primaryCompetitor || competitor || null,
    analysis,
  };
  const entries = await appendWorkspaceList(req.workspaceId, 'win-loss', entry);
  await trackUsage(req.workspaceId, 'win_loss');
  res.json({ entry, entries });
}));

// ─── Positioning lab ────────────────────────────────────────────────────────
router.post('/positioning-lab', wrap(async (req, res) => {
  const { focus } = req.body || {};
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `You are a positioning strategist. Return JSON:
{ "options": [{ "name": string, "statement": string, "audience": string, "differentiation": string, "risks": string[], "score": 1-10, "why": string }], "recommendation": string, "messagingDo": string[], "messagingDont": string[] }
Generate exactly 3 distinct positioning options.`,
    user: JSON.stringify({ product: ctx.product, competitors: ctx.competitors.map((c) => ({ name: c.name, notes: c.notes })), focus: focus || null }),
    maxTokens: 2200,
  });
  await setWorkspaceJson(req.workspaceId, 'positioning-lab-latest', { ...result, generatedAt: new Date().toISOString() });
  await trackUsage(req.workspaceId, 'positioning_lab');
  res.json({ result });
}));

router.get('/positioning-lab', wrap(async (req, res) => {
  res.json({ result: await getWorkspaceJson(req.workspaceId, 'positioning-lab-latest', null) });
}));

// ─── Pricing simulator ──────────────────────────────────────────────────────
router.post('/pricing-simulator', wrap(async (req, res) => {
  const { planName, deltaPct = 0, absolutePrice = null } = req.body || {};
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `Simulate a pricing change for a SaaS product. Return JSON:
{ "scenario": string, "yourNewPrice": string, "competitivePosition": string, "valueScatterNote": string, "upsides": string[], "downsides": string[], "recommendation": string, "suggestedPackaging": string[] }`,
    user: JSON.stringify({
      product: ctx.product,
      planName: planName || 'primary plan',
      deltaPct,
      absolutePrice,
      competitors: ctx.competitors.map((c) => ({ name: c.name, notes: c.notes, value_score: c.value_score })),
    }),
    maxTokens: 1600,
  });
  await trackUsage(req.workspaceId, 'pricing_simulator');
  res.json({ result });
}));

// ─── Feature gap radar ──────────────────────────────────────────────────────
router.post('/feature-gaps', wrap(async (req, res) => {
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `Identify likely feature gaps vs competitors from available notes and public positioning cues. Return JSON:
{ "gaps": [{ "feature": string, "whoHasIt": string[], "severity": "low"|"medium"|"high", "effort": "S"|"M"|"L", "rationale": string }], "quickWins": string[], "summary": string }`,
    user: JSON.stringify({
      product: ctx.product,
      competitors: ctx.competitors.map((c) => ({ name: c.name, notes: c.notes, website: c.website })),
      recentChanges: ctx.changes.slice(0, 8),
    }),
    maxTokens: 2000,
  });
  await setWorkspaceJson(req.workspaceId, 'feature-gaps-latest', { ...result, generatedAt: new Date().toISOString() });
  await trackUsage(req.workspaceId, 'feature_gaps');
  res.json({ result });
}));

router.get('/feature-gaps', wrap(async (req, res) => {
  res.json({ result: await getWorkspaceJson(req.workspaceId, 'feature-gaps-latest', null) });
}));

// ─── Evidence locker ────────────────────────────────────────────────────────
router.get('/evidence', wrap(async (req, res) => {
  res.json({ items: (await getWorkspaceJson(req.workspaceId, 'evidence', [])) || [] });
}));

router.post('/evidence', wrap(async (req, res) => {
  const { quote, source, theme, competitor, sentiment = 'neutral' } = req.body || {};
  if (!quote?.trim()) return res.status(400).json({ error: 'quote required' });
  const item = {
    id: `${Date.now()}`,
    at: new Date().toISOString(),
    quote: quote.trim(),
    source: source || null,
    theme: theme || null,
    competitor: competitor || null,
    sentiment,
  };
  const items = await appendWorkspaceList(req.workspaceId, 'evidence', item, { max: 200 });
  res.json({ item, items });
}));

router.delete('/evidence/:id', wrap(async (req, res) => {
  const items = ((await getWorkspaceJson(req.workspaceId, 'evidence', [])) || []).filter((i) => i.id !== req.params.id);
  await setWorkspaceJson(req.workspaceId, 'evidence', items);
  res.json({ ok: true, items });
}));

router.delete('/evidence', wrap(async (req, res) => {
  await setWorkspaceJson(req.workspaceId, 'evidence', []);
  res.json({ ok: true, items: [] });
}));

// ─── War room ───────────────────────────────────────────────────────────────
router.get('/war-room', wrap(async (req, res) => {
  res.json({ deals: (await getWorkspaceJson(req.workspaceId, 'war-room', [])) || [] });
}));

router.post('/war-room', wrap(async (req, res) => {
  const { title, competitor, stage = 'discovery', notes = '', talkTrack = '' } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const deal = {
    id: `${Date.now()}`,
    at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: title.trim(),
    competitor: competitor || null,
    stage,
    notes,
    talkTrack,
  };
  const deals = await appendWorkspaceList(req.workspaceId, 'war-room', deal);
  res.json({ deal, deals });
}));

router.patch('/war-room/:id', wrap(async (req, res) => {
  const deals = ((await getWorkspaceJson(req.workspaceId, 'war-room', [])) || []).map((d) => {
    if (d.id !== req.params.id) return d;
    return { ...d, ...req.body, id: d.id, updatedAt: new Date().toISOString() };
  });
  await setWorkspaceJson(req.workspaceId, 'war-room', deals);
  res.json({ deals, deal: deals.find((d) => d.id === req.params.id) });
}));

router.delete('/war-room/:id', wrap(async (req, res) => {
  const deals = ((await getWorkspaceJson(req.workspaceId, 'war-room', [])) || []).filter((d) => d.id !== req.params.id);
  await setWorkspaceJson(req.workspaceId, 'war-room', deals);
  res.json({ ok: true, deals });
}));

router.delete('/war-room', wrap(async (req, res) => {
  await setWorkspaceJson(req.workspaceId, 'war-room', []);
  res.json({ ok: true, deals: [] });
}));

// ─── Market entry checklist ─────────────────────────────────────────────────
router.post('/market-entry', wrap(async (req, res) => {
  const { geography, segment } = req.body || {};
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `Build a market entry checklist for expansion. Return JSON:
{ "summary": string, "checklist": [{ "item": string, "owner": string, "priority": "P0"|"P1"|"P2", "done": false }], "risks": string[], "samSomHint": string }`,
    user: JSON.stringify({
      geography: geography || 'new region',
      segment: segment || 'adjacent ICP',
      product: ctx.product,
      distribution: ctx.distribution,
      competitors: ctx.competitors.map((c) => c.name),
    }),
    maxTokens: 1800,
  });
  await setWorkspaceJson(req.workspaceId, 'market-entry-latest', {
    ...result,
    geography,
    segment,
    generatedAt: new Date().toISOString(),
  });
  await trackUsage(req.workspaceId, 'market_entry');
  res.json({ result });
}));

router.get('/market-entry', wrap(async (req, res) => {
  res.json({ result: await getWorkspaceJson(req.workspaceId, 'market-entry-latest', null) });
}));

// ─── Investor one-pager ─────────────────────────────────────────────────────
router.post('/investor-onepager', wrap(async (req, res) => {
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `Write an investor-ready one-pager as JSON:
{ "headline": string, "problem": string, "solution": string, "market": string, "competition": string, "differentiation": string, "tractionPlaceholder": string, "risks": string[], "ask": string, "markdown": string }
markdown should be a clean 1-page memo.`,
    user: JSON.stringify({
      product: ctx.product,
      competitors: ctx.competitors.map((c) => ({ name: c.name, notes: c.notes })),
      distribution: ctx.distribution,
    }),
    maxTokens: 2500,
  });
  await setWorkspaceJson(req.workspaceId, 'investor-onepager-latest', { ...result, generatedAt: new Date().toISOString() });
  await trackUsage(req.workspaceId, 'investor_onepager');
  res.json({ result });
}));

router.get('/investor-onepager', wrap(async (req, res) => {
  res.json({ result: await getWorkspaceJson(req.workspaceId, 'investor-onepager-latest', null) });
}));

// ─── Competitor tags + watchlist alerts ─────────────────────────────────────
router.get('/competitor-meta', wrap(async (req, res) => {
  const tags = (await getWorkspaceJson(req.workspaceId, 'competitor-tags', {})) || {};
  const alerts = (await getWorkspaceJson(req.workspaceId, 'watchlist-alerts', { thresholdPct: 10, enabled: true })) || {};
  res.json({ tags, alerts });
}));

router.put('/competitor-meta/tags', wrap(async (req, res) => {
  const { competitorId, tags } = req.body || {};
  if (!competitorId) return res.status(400).json({ error: 'competitorId required' });
  const all = (await getWorkspaceJson(req.workspaceId, 'competitor-tags', {})) || {};
  all[competitorId] = Array.isArray(tags) ? tags : [];
  await setWorkspaceJson(req.workspaceId, 'competitor-tags', all);
  res.json({ tags: all });
}));

router.put('/competitor-meta/alerts', wrap(async (req, res) => {
  const alerts = {
    thresholdPct: Number(req.body?.thresholdPct) || 10,
    enabled: req.body?.enabled !== false,
  };
  await setWorkspaceJson(req.workspaceId, 'watchlist-alerts', alerts);
  res.json({ alerts });
}));

// ─── Company compare + implications ─────────────────────────────────────────
router.post('/compare-companies', wrap(async (req, res) => {
  const { companies } = req.body || {};
  if (!Array.isArray(companies) || companies.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 company names' });
  }
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `Compare companies for a founder. Return JSON:
{ "summary": string, "dimensions": [{ "name": string, "scores": { [company]: number }, "notes": string }], "implicationsForUs": string[], "recommendation": string }`,
    user: JSON.stringify({ companies: companies.slice(0, 4), ourProduct: ctx.product, tracked: ctx.competitors.map((c) => c.name) }),
    maxTokens: 2000,
  });
  await trackUsage(req.workspaceId, 'compare_companies');
  res.json({ result });
}));

router.post('/implications', wrap(async (req, res) => {
  const { dossier } = req.body || {};
  const ctx = await loadContext(req.workspaceId);
  const result = await completeJSON({
    system: `Given a company deep-dive dossier and our product, return JSON:
{ "summary": string, "threats": string[], "opportunities": string[], "actions": string[] }`,
    user: JSON.stringify({ dossier: dossier || {}, product: ctx.product }),
    maxTokens: 1400,
  });
  res.json({ result });
}));

// ─── Market scenarios (TAM/SAM/SOM) ──────────────────────────────────────────
router.post('/market-scenarios', wrap(async (req, res) => {
  const { base } = req.body || {};
  const result = await completeJSON({
    system: `Given market model inputs, produce base/bull/bear scenarios. Return JSON:
{ "scenarios": [{ "name": "base"|"bull"|"bear", "tamUsd": number, "samUsd": number, "somUsd": number, "assumptions": string[], "probability": number }], "narrative": string }`,
    user: JSON.stringify({ base: base || {} }),
    maxTokens: 1600,
  });
  await setWorkspaceJson(req.workspaceId, 'market-scenarios-latest', { ...result, generatedAt: new Date().toISOString() });
  res.json({ result });
}));

router.get('/market-scenarios', wrap(async (req, res) => {
  res.json({ result: await getWorkspaceJson(req.workspaceId, 'market-scenarios-latest', null) });
}));

// ─── Report PDF/markdown export helper ──────────────────────────────────────
router.post('/export-report', wrap(async (req, res) => {
  const { snapshot, format = 'markdown' } = req.body || {};
  if (!snapshot) return res.status(400).json({ error: 'snapshot required' });
  const md = await complete({
    system: 'Convert this competitive intelligence snapshot into a clean founder-facing markdown report with headings. No preamble.',
    user: JSON.stringify(snapshot).slice(0, 40000),
    maxTokens: 3500,
    temperature: 0.2,
  });
  await trackUsage(req.workspaceId, 'export_report');
  res.json({ format, markdown: md });
}));

// ─── Usage meters ───────────────────────────────────────────────────────────
router.get('/usage', wrap(async (req, res) => {
  const usage = (await getWorkspaceJson(req.workspaceId, 'usage', { events: [], totals: {} })) || { events: [], totals: {} };
  res.json({ usage });
}));

// ─── Workspace export / retention ───────────────────────────────────────────
router.get('/export-workspace', wrap(async (req, res) => {
  const ctx = await loadContext(req.workspaceId);
  const [evidence, warRoom, winLoss, nextMoves] = await Promise.all([
    getWorkspaceJson(req.workspaceId, 'evidence', []),
    getWorkspaceJson(req.workspaceId, 'war-room', []),
    getWorkspaceJson(req.workspaceId, 'win-loss', []),
    getWorkspaceJson(req.workspaceId, 'next-moves-latest', null),
  ]);
  res.json({
    exportedAt: new Date().toISOString(),
    workspaceId: req.workspaceId,
    product: ctx.product,
    competitors: ctx.competitors,
    distribution: ctx.distribution,
    evidence,
    warRoom,
    winLoss,
    nextMoves,
  });
}));

router.delete('/retention', wrap(async (req, res) => {
  const keys = ['notifications', 'evidence', 'war-room', 'win-loss', 'usage'];
  for (const k of keys) await setWorkspaceJson(req.workspaceId, k, k === 'usage' ? { events: [], totals: {} } : []);
  res.json({ ok: true, cleared: keys });
}));

// ─── Digest personalization prefs ───────────────────────────────────────────
router.get('/digest-prefs', wrap(async (req, res) => {
  const prefs = (await getWorkspaceJson(req.workspaceId, 'digest-prefs', {
    onlySignificant: true,
    topActions: 3,
    includeDistribution: true,
  })) || {};
  res.json({ prefs });
}));

router.put('/digest-prefs', wrap(async (req, res) => {
  const prefs = {
    onlySignificant: req.body?.onlySignificant !== false,
    topActions: Math.min(10, Math.max(1, Number(req.body?.topActions) || 3)),
    includeDistribution: req.body?.includeDistribution !== false,
  };
  await setWorkspaceJson(req.workspaceId, 'digest-prefs', prefs);
  res.json({ prefs });
}));

export default router;
