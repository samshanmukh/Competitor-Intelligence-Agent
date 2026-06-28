import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { getCompetitor, listSnapshots, getLatestSnapshot, listCompetitors } from '../db/index.js';
import { completeJSON, complete } from '../services/ai.js';

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

export default router;
