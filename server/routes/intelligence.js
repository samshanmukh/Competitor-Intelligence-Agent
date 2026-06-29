import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { getCompetitor, listSnapshots, getLatestSnapshot, listCompetitors } from '../db/index.js';
import { getProduct } from '../db/products.js';
import { completeJSON, complete } from '../services/ai.js';
import { research, financeResearch } from '../services/youcom.js';
import { createJob, getJob, completeJob, failJob } from '../services/jobs.js';
import { sendPushToWorkspace } from '../services/push.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Price history — extract price points from all snapshots for a competitor
router.get('/competitors/:id/price-history', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const competitor = await getCompetitor(req.params.id);
  if (!competitor) return res.status(404).json({ error: 'Not found' });

  const snapshots = await listSnapshots(competitor.id);
  if (!snapshots.length) return res.json({ history: [] });

  // Limit to last 20 snapshots to keep cost down
  const recent = snapshots.slice(0, 20);
  const history = [];

  // Extract prices from each snapshot using AI (batch to reduce calls)
  for (const snap of recent) {
    if (!snap.content) continue;
    try {
      const result = await completeJSON({
        system: 'You extract pricing data from website content. Return ONLY valid JSON.',
        user: `Extract pricing from this content. Return: { "tiers": [{ "name": "string", "price_monthly": number|null, "price_annual": number|null, "currency": "USD" }] }\n\n${snap.content?.slice(0, 4000)}`,
        maxTokens: 400,
      });
      if (result?.tiers?.length) {
        history.push({ date: snap.fetched_at, tiers: result.tiers });
      }
    } catch { /* skip failed snapshots */ }
  }

  res.json({ competitor: { id: competitor.id, name: competitor.name }, history });
}));

// Feature matrix — compare multiple competitors side by side
router.post('/feature-matrix', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { competitorIds } = req.body || {};
  if (!Array.isArray(competitorIds) || !competitorIds.length) {
    return res.status(400).json({ error: 'competitorIds array required' });
  }

  const snapshots = await Promise.all(
    competitorIds.map(async (id) => {
      const c = await getCompetitor(id);
      const snap = await getLatestSnapshot(id);
      return { competitor: c, content: snap?.content };
    })
  );

  const prompt = snapshots
    .filter((s) => s.competitor && s.content)
    .map((s) => `== ${s.competitor.name} ==\n${s.content?.slice(0, 3000)}`)
    .join('\n\n');

  if (!prompt) return res.json({ features: [], competitors: [] });

  const matrix = await completeJSON({
    system: 'You extract feature comparison data from pricing pages. Return ONLY valid JSON.',
    user: `Compare these competitors and extract a feature matrix. Return:
{
  "features": ["feature1", "feature2", ...],
  "competitors": [
    {
      "name": "string",
      "tiers": [
        { "name": "string", "price_monthly": number|null, "features": [true, false, ...] }
      ]
    }
  ]
}

Make features concise (3-5 words max). Include 10-20 meaningful differentiating features.

${prompt}`,
    maxTokens: 2000,
  });

  res.json(matrix || { features: [], competitors: [] });
}));

// Positioning analysis — market overview for all workspace competitors
router.post('/positioning', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const competitors = await listCompetitors('approved', req.workspaceId);
  if (!competitors.length) return res.json({ analysis: null });

  const summaries = await Promise.all(
    competitors.map(async (c) => {
      const snap = await getLatestSnapshot(c.id);
      return {
        name: c.name,
        value_score: c.value_score,
        value_analysis: c.value_analysis,
        content: snap?.content?.slice(0, 2000),
      };
    })
  );

  const prompt = summaries
    .map((s) => `${s.name}:\n${s.content || '(no data)'}`)
    .join('\n\n---\n\n');

  const analysis = await complete({
    system: `You are a strategic pricing analyst. Analyze competitive positioning.`,
    user: `Analyze the market landscape from these competitor pricing pages:

${prompt}

Write a structured analysis with these sections:
1. **Market Overview** — key price ranges, positioning tiers
2. **Market Gaps** — underserved segments or price points
3. **Competitive Dynamics** — who competes with who and why
4. **Repricing Recommendation** — specific advice with reasoning
5. **Key Risks** — if you reprice, what to watch out for

Be specific, reference actual competitor names and prices.`,
    maxTokens: 1500,
  });

  res.json({ analysis, competitors: summaries.map((s) => ({ name: s.name, value_score: s.value_score })) });
}));

// Battlecard generator
router.post('/competitors/:id/battlecard', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const competitor = await getCompetitor(req.params.id);
  if (!competitor) return res.status(404).json({ error: 'Not found' });

  const snap = await getLatestSnapshot(competitor.id);
  if (!snap) return res.status(400).json({ error: 'No snapshot available for this competitor' });

  const battlecard = await completeJSON({
    system: 'You are a sales strategist. Generate battle cards for competitive deals.',
    user: `Generate a sales battlecard for competing against ${competitor.name}.

Pricing page content:
${snap.content?.slice(0, 4000)}

Return JSON:
{
  "competitor": "${competitor.name}",
  "elevator_pitch": "one sentence: why you beat them",
  "strengths": ["their strength 1", "..."],
  "weaknesses": ["their weakness 1", "..."],
  "how_to_win": ["tactic 1", "tactic 2", "..."],
  "common_objections": [
    { "objection": "customer says X", "response": "you reply Y" }
  ],
  "pricing_comparison": "brief comparison narrative"
}`,
    maxTokens: 1200,
  });

  res.json({ battlecard: battlecard || null });
}));

// Value scoring — run AI analysis and update competitor record
router.post('/competitors/:id/value-score', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const competitor = await getCompetitor(req.params.id);
  if (!competitor) return res.status(404).json({ error: 'Not found' });

  const snap = await getLatestSnapshot(competitor.id);
  if (!snap) return res.json({ score: null });

  const result = await completeJSON({
    system: 'You rate software products on value-for-money. Return ONLY valid JSON.',
    user: `Rate ${competitor.name} on value-for-money (1-10 scale).

Pricing content:
${snap.content?.slice(0, 3000)}

Return: { "score": number, "reasoning": "2-3 sentences" }`,
    maxTokens: 300,
  });

  if (result?.score) {
    const { createClient } = await import('@insforge/sdk');
    const insforge = createClient({
      baseUrl: process.env.INSFORGE_BASE_URL || 'https://tpq6mvqe.us-east.insforge.app',
      anonKey: process.env.INSFORGE_ANON_KEY || 'anon_b6023a1adec5472cfe335ee7fec1139a85bd05a43a2f0513e2eba963c4a71d1f',
    });
    await insforge.database
      .from('competitors')
      .update({ value_score: result.score, value_analysis: result.reasoning })
      .eq('id', competitor.id);
  }

  res.json({ score: result?.score || null, reasoning: result?.reasoning || null });
}));

// Review sentiment — fetch reviews via You.com Research and summarize per competitor.
router.post('/reviews', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { competitorIds } = req.body || {};
  const competitors = competitorIds?.length
    ? await Promise.all(competitorIds.map((id) => getCompetitor(id)))
    : await listCompetitors('approved', req.workspaceId);

  const valid = competitors.filter(Boolean);
  const reviews = [];

  for (const c of valid) {
    try {
      const payload = await research(
        `${c.name} software customer reviews ratings pros and cons on G2, Capterra, Trustpilot`
      );
      const researchText = flattenResearch(payload).slice(0, 6000);
      if (!researchText) { reviews.push({ name: c.name, id: c.id, sentiment: null }); continue; }

      const summary = await completeJSON({
        system: 'You summarize software product reviews into structured sentiment. Return ONLY valid JSON.',
        user: `Summarize the customer review sentiment for ${c.name} from this research.

Return JSON:
{
  "rating": number|null,        // average star rating out of 5 if mentioned
  "sentiment": "positive" | "mixed" | "negative",
  "pros": ["..."],              // top 3-4 praised points
  "cons": ["..."],              // top 3-4 complaints
  "summary": "one-sentence overall take"
}

RESEARCH:
${researchText}`,
        maxTokens: 700,
      });
      reviews.push({ name: c.name, id: c.id, ...(summary || { sentiment: null }) });
    } catch (err) {
      reviews.push({ name: c.name, id: c.id, sentiment: null, error: err.message });
    }
  }

  res.json({ reviews });
}));

// Analyst take — the LLM's personal research commentary on the whole landscape,
// framed against the workspace's own product.
router.post('/analyst-take', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const [product, competitors] = await Promise.all([
    getProduct(req.workspaceId),
    listCompetitors('approved', req.workspaceId),
  ]);

  if (!competitors.length) return res.json({ take: null });

  const competitorSummaries = await Promise.all(
    competitors.map(async (c) => {
      const snap = await getLatestSnapshot(c.id);
      return `### ${c.name}\nValue score: ${c.value_score ?? 'n/a'}\n${(snap?.content || '').slice(0, 1500)}`;
    })
  );

  const productContext = product
    ? `MY PRODUCT: ${product.name}\n${product.description || ''}\nPricing: ${product.pricing_url || 'n/a'}`
    : 'MY PRODUCT: (not yet defined)';

  const take = await complete({
    system: `You are a senior competitive intelligence analyst writing a candid, opinionated briefing for a founder. Write in first person ("I"). Be direct, specific, and useful — cite real names and prices. Avoid hedging and filler.`,
    user: `${productContext}

COMPETITORS:
${competitorSummaries.join('\n\n')}

Write your personal analyst briefing with these clearly-labelled sections (use **bold** headers):
**My Read on the Market** — what's really going on with pricing/positioning here
**Where You Win** — specific advantages my product has or could press
**Where You're Exposed** — honest risks and gaps vs these competitors
**What I'd Do Next** — 3-4 concrete, prioritized recommendations

Keep it tight and high-signal.`,
    maxTokens: 1400,
  });

  res.json({ take });
}));

// Market intelligence — uses You.com Finance Research for market size, growth
// timeline, and competitor funding/revenue. Slow (1–3 min), so it runs as a
// background job (see /market/start + /market/status below).
async function runMarketIntel(workspaceId, effort = 'deep') {
  const [product, competitors] = await Promise.all([
    getProduct(workspaceId),
    listCompetitors('approved', workspaceId),
  ]);

  const marketName = product?.description?.slice(0, 200) || product?.name || 'this market';
  const names = competitors.map((c) => c.name).slice(0, 8);

  const input = `For the market "${marketName}": estimate the total market size for the last 5 years (give a number per year if possible) and the annual growth rate (CAGR). Then for each of these companies estimate funding raised, annual revenue, and valuation where known: ${names.join(', ')}. Provide concrete numbers and cite sources.`;

  const payload = await financeResearch(input, effort === 'exhaustive' ? 'exhaustive' : 'deep');
  const researchText = flattenResearch(payload).slice(0, 12000);
  if (!researchText) return null;

  const structured = await completeJSON({
    system: 'You convert financial research text into structured JSON for charts. Use only numbers present in the text. Return ONLY valid JSON.',
    user: `From the finance research below, extract:
{
  "market": {
    "size_current": "e.g. $1.0B (2024)",
    "cagr": "e.g. ~18% CAGR",
    "history": [ { "year": 2019, "size_usd_millions": 500 } ],  // yearly market size if available, ascending
    "summary": "2-3 sentence market overview"
  },
  "companies": [
    { "name": "", "funding": "e.g. $40M or null", "revenue": "e.g. $20M est or null", "valuation": "or null", "note": "one line" }
  ],
  "narrative": "a short paragraph on market dynamics and what it means for pricing/positioning"
}
Only include years/companies actually supported by the text. Use null when unknown.

FINANCE RESEARCH:
${researchText}`,
    maxTokens: 1600,
  });

  if (!structured) return null;
  const sources = (payload?.output?.sources || []).slice(0, 8).map((s) => ({ title: s.title, url: s.url }));

  // Grok returns { market: {size_current,cagr,history,summary}, companies, narrative }.
  // Flatten to the shape the UI expects (tolerating either nesting).
  const m = structured.market && typeof structured.market === 'object' ? structured.market : structured;
  return {
    size_current: m.size_current ?? null,
    cagr: m.cagr ?? null,
    history: Array.isArray(m.history) ? m.history : [],
    summary: m.summary ?? null,
    companies: Array.isArray(structured.companies) ? structured.companies : [],
    narrative: structured.narrative ?? null,
    sources,
  };
}

// Start a background market-intelligence job; returns immediately with a jobId.
router.post('/market/start', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const effort = req.body?.effort === 'exhaustive' ? 'exhaustive' : 'deep';
  const workspaceId = req.workspaceId;
  const jobId = createJob({ workspaceId, userId: req.user.id, type: 'market' });

  // Run without blocking the response.
  runMarketIntel(workspaceId, effort)
    .then((market) => {
      completeJob(jobId, { market });
      sendPushToWorkspace(workspaceId, {
        title: 'Market intelligence ready',
        body: 'Your deep market research has finished — open the report to view it.',
        url: '/app',
        tag: `market-${jobId}`,
      }, 'any').catch(() => {});
    })
    .catch((err) => failJob(jobId, err.message));

  res.json({ jobId });
}));

// Poll a market-intelligence job.
router.get('/market/status/:jobId', requireAuth, wrap(async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired', code: 'JOB_NOT_FOUND' });
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Helper: flatten You.com research payload to text (mirrors discoveryAgent).
function flattenResearch(payload) {
  const parts = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) parts.push(v.trim()); };
  if (payload?.output) {
    push(payload.output.content);
    for (const src of payload.output.sources || []) {
      push([src.title, src.url, (src.snippets || []).join(' ')].filter(Boolean).join(' — '));
    }
  }
  push(payload?.answer); push(payload?.summary); push(payload?.text);
  for (const bucket of [payload?.results, payload?.sources, payload?.citations, payload?.web_results]) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (typeof item === 'string') { push(item); continue; }
      push([item.title || item.name, item.url || item.link, item.snippet || item.description].filter(Boolean).join(' — '));
    }
  }
  return parts.join('\n');
}

export default router;
