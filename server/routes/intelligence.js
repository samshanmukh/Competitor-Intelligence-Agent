import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import insforge, {
  getCompetitor,
  listSnapshots,
  getLatestSnapshot,
  insertSnapshot,
  listCompetitors,
  getSetting,
  setSetting,
  listRecentChanges,
  updateCompetitorPricingUrl,
} from '../db/index.js';
import { getProduct } from '../db/products.js';
import { getMarketModel, saveMarketModel, insertModelHistory, getModelHistory } from '../db/marketModel.js';
import { completeJSON, complete } from '../services/ai.js';
import { research, financeResearch, fetchContents, webSearch } from '../services/youcom.js';
import { tavilySearch, tavilyConfigured } from '../services/tavily.js';
import { createJob, getJob, completeJob, failJob } from '../services/jobs.js';
import { sendPushToWorkspace } from '../services/push.js';
import {
  computeMarketDistribution,
  enrichCompaniesWithDistribution,
  parseMoneyToUsd,
  resolveTamUsd,
  diffDistribution,
  distributionSnapshotKey,
  getSignificantShifts,
} from '../services/marketDistribution.js';
import { resolveTrafficForCompetitors } from '../services/trafficSignals.js';
import { generateMarketInsights } from '../services/marketInsights.js';
import {
  fetchAndExtractSyndicatedShare,
  buildSyndicatedTable,
  syndicatedSnapshotKey,
} from '../services/syndicatedShare.js';
import { sendMarketShiftWebhook } from '../services/alerts.js';
import { getWorkspaceJson, setWorkspaceJson } from '../services/workspaceStore.js';
import { makeAttribution } from '../services/attribution.js';
import { fetchCompetitor } from '../agents/fetchAgent.js';
import {
  fetchStorePricingContent,
  contentLooksLikeStorePricing,
  isStoreUrl,
  storeSourceLabel,
  storeSourceType,
} from '../services/storePricing.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function sourceFromUrl(url, title) {
  if (!url) return null;
  const type = isStoreUrl(url) ? storeSourceType(url) : 'pricing_page';
  return {
    type,
    url,
    title: title || storeSourceLabel(type, url),
    label: storeSourceLabel(type, url),
  };
}

function mergeSources(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    // Call sites pass either an array, a single source object, or null.
    const items = Array.isArray(list) ? list : (list ? [list] : []);
    for (const s of items) {
      if (!s) continue;
      const key = `${s.type || ''}|${s.url || s.label || s.title || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

// Price history — extract price points from all snapshots for a competitor
router.get('/competitors/:id/price-history', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const competitor = await getCompetitor(req.params.id, req.workspaceId);
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

// Helper: fetch the best available content describing the user's own product.
async function getProductContent(product) {
  if (!product) return null;
  let content = product.description || '';
  if (product.pricing_url) {
    try {
      const map = await fetchContents([product.pricing_url]);
      const md = map[product.pricing_url]?.markdown;
      if (md) content = md;
    } catch { /* fall back to description */ }
  }
  if (product.pricing_data) content += `\n\nManual pricing details: ${product.pricing_data}`;
  return content || null;
}

/** Thin scraper stubs (blocked pages) must not block You.com research fallback. */
function contentUsefulForPricing(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 200) return false;
  if (/\$\s?\d/.test(t)) return true;
  if (/\b(in-?app purchases?|subscription|weekly|monthly|yearly)\b/i.test(t) && t.length >= 350) return true;
  if (/\b(pricing|per month|\/mo|plan|tier)\b/i.test(t) && t.length >= 800) return true;
  return t.length >= 1500;
}

function flattenResearchPayload(payload) {
  return [
    payload?.output?.content,
    ...(payload?.output?.sources || []).slice(0, 6).map((s) => (
      [s.title, s.url, (s.snippets || []).join(' ')].filter(Boolean).join(' — ')
    )),
  ].filter(Boolean).join('\n');
}

async function researchPricingContent(competitorOrName) {
  const name = typeof competitorOrName === 'string' ? competitorOrName : competitorOrName?.name;
  if (!name) return null;
  const website = typeof competitorOrName === 'object' ? competitorOrName.website : null;
  const q = [
    `${name} official pricing plans tiers monthly cost USD`,
    website ? `(${website})` : '',
    'subscription price per month',
    'OR App Store OR Google Play in-app purchase subscription price',
  ].filter(Boolean).join(' ');
  try {
    const payload = await research(q, { effort: 'lite' });
    const text = flattenResearchPayload(payload).trim();
    if (!text) return null;
    const sources = (payload?.output?.sources || [])
      .filter((s) => s?.url)
      .slice(0, 6)
      .map((s) => sourceFromUrl(s.url, s.title) || {
        type: 'research',
        url: s.url,
        title: s.title || 'Research',
        label: storeSourceLabel('research', s.url),
      });
    return { content: text.slice(0, 8000), sources };
  } catch {
    return null;
  }
}

/**
 * Prefer a useful stored snapshot; else fetch pricing pages; else App/Play Store;
 * else You.com research. Returns { content, sources }.
 */
async function ensureCompetitorContent(competitor) {
  if (!competitor?.id) return { content: null, sources: [] };
  const baseSources = mergeSources(
    sourceFromUrl(competitor.pricing_url, 'Pricing page'),
    sourceFromUrl(competitor.website, 'Website'),
  );

  const snap = await getLatestSnapshot(competitor.id);
  if (contentUsefulForPricing(snap?.content)) {
    const snapSource = snap.source
      ? [{
          type: snap.source,
          url: isStoreUrl(competitor.pricing_url) ? competitor.pricing_url : null,
          title: storeSourceLabel(snap.source, competitor.pricing_url),
          label: storeSourceLabel(snap.source, competitor.pricing_url),
        }]
      : [];
    return {
      content: snap.content,
      sources: mergeSources(baseSources, snapSource),
    };
  }

  const urls = [competitor.pricing_url, competitor.website].filter(Boolean);
  for (const url of urls) {
    try {
      const fetched = await fetchCompetitor({ ...competitor, pricing_url: url });
      const text = fetched?.snapshot?.content;
      if (fetched?.ok && contentUsefulForPricing(text)) {
        return {
          content: text,
          sources: mergeSources(baseSources, sourceFromUrl(url)),
        };
      }
    } catch {
      /* try next */
    }
  }

  // No useful website pricing → App Store / Play Store IAP subscriptions.
  try {
    const store = await fetchStorePricingContent(competitor);
    if (store?.content && contentLooksLikeStorePricing(store.content)) {
      try {
        await insertSnapshot(competitor.id, store.content, store.kind || 'app-store');
      } catch {
        /* non-fatal */
      }
      // Point future refreshes at the store listing when website pricing failed.
      const storeUrl = store.appStore || store.playStore;
      if (storeUrl && competitor.id && !isStoreUrl(competitor.pricing_url)) {
        try {
          await updateCompetitorPricingUrl(competitor.id, storeUrl);
          competitor.pricing_url = storeUrl;
        } catch {
          /* non-fatal */
        }
      }
      return {
        content: store.content,
        sources: mergeSources(baseSources, store.sources),
      };
    }
  } catch {
    /* fall through to research */
  }

  const researched = await researchPricingContent(competitor);
  if (researched?.content) {
    try {
      await insertSnapshot(competitor.id, researched.content, 'you-research');
    } catch {
      /* non-fatal */
    }
    return {
      content: researched.content,
      sources: mergeSources(baseSources, researched.sources, [{
        type: 'research',
        url: null,
        title: 'Pricing research',
        label: 'Research',
      }]),
    };
  }

  // Last resort: return whatever scrape we have (may still help features/value).
  return {
    content: snap?.content || null,
    sources: baseSources,
  };
}

// Analyze the user's OWN product (pricing tiers + value score) so it can be
// shown alongside competitors in the report.
router.post('/product-analysis', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const product = await getProduct(req.workspaceId);
  if (!product) return res.json({ product: null });

  const content = await getProductContent(product);
  if (!content) {
    return res.json({ product: { name: product.name, pricing_url: product.pricing_url, tiers: [], value_score: null } });
  }

  let pricingContent = content;
  let pricingSources = mergeSources(sourceFromUrl(product.pricing_url, 'Pricing page'));
  if (!contentUsefulForPricing(pricingContent)) {
    try {
      const store = await fetchStorePricingContent({
        name: product.name,
        website: product.website || product.pricing_url,
        pricing_url: product.pricing_url,
      });
      if (store?.content && contentLooksLikeStorePricing(store.content)) {
        pricingContent = `${pricingContent || ''}\n\n${store.content}`.trim();
        pricingSources = mergeSources(pricingSources, store.sources);
      }
    } catch {
      /* optional */
    }
  }

  const result = await completeJSON({
    system: "You analyze a software product's pricing and positioning. Return ONLY valid JSON.",
    user: `Analyze the product "${product.name}". Extract its pricing tiers and rate its value-for-money.
Include App Store / Google Play subscription and in-app purchase tiers when present (convert weekly/yearly to monthly USD).
Return:
{
  "tiers": [ { "name": "string", "price_monthly": number|null } ],
  "value_score": number,        // 1-10 value for money
  "value_analysis": "2-3 sentences on its value vs price",
  "summary": "one line on how it's positioned"
}
Use numbers only where present in the content.

CONTENT:
${pricingContent.slice(0, 5000)}`,
    maxTokens: 700,
  });

  res.json({
    product: {
      name: product.name,
      pricing_url: product.pricing_url,
      tiers: result?.tiers || [],
      value_score: result?.value_score ?? null,
      value_analysis: result?.value_analysis || null,
      summary: result?.summary || null,
      pricing_sources: pricingSources,
    },
  });
}));

// Feature matrix — compare competitors (and optionally the user's product) side by side
router.post('/feature-matrix', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { competitorIds, includeProduct } = req.body || {};
  if (!Array.isArray(competitorIds) || !competitorIds.length) {
    return res.status(400).json({ error: 'competitorIds array required' });
  }

  // Load every rival with useful pricing/feature text
  // (scrape → App/Play Store → research). Never let a thin blocked page leave
  // rivals out of the matrix prompt.
  const snapshots = await Promise.all(
    competitorIds.map(async (id) => {
      const c = await getCompetitor(id, req.workspaceId);
      if (!c) return { competitor: null, content: null, sources: [] };
      let { content, sources } = await ensureCompetitorContent(c);
      if (!contentUsefulForPricing(content)) {
        const researched = await researchPricingContent(c);
        if (researched?.content) {
          content = researched.content;
          sources = mergeSources(sources, researched.sources);
          try { await insertSnapshot(c.id, researched.content, 'you-research'); } catch { /* ignore */ }
        }
      }
      return { competitor: c, content, sources: sources || [] };
    })
  );

  // Optionally prepend the user's own product so it appears as a column.
  let productName = null;
  let productEntry = '';
  if (includeProduct) {
    const product = await getProduct(req.workspaceId);
    const pc = await getProductContent(product);
    if (product && pc) {
      productName = product.name;
      productEntry = `== ${product.name} (THIS IS THE USER'S OWN PRODUCT) ==\n${pc.slice(0, 4000)}\n\n`;
    }
  }

  const competitorPrompt = snapshots
    .filter((s) => s.competitor && s.content)
    .map((s) => `== ${s.competitor.name} ==\n${s.content?.slice(0, 4000)}`)
    .join('\n\n');

  const prompt = productEntry + competitorPrompt;
  if (!prompt.trim()) {
    // Still return stubs so the Pricing tab can show every approved rival.
    return res.json({
      features: [],
      competitors: snapshots
        .filter((s) => s.competitor)
        .map((s) => ({
          name: s.competitor.name,
          tiers: [],
          pricing_url: s.competitor.pricing_url || null,
          pricing_sources: s.sources || [],
        })),
      productName,
    });
  }

  const namedProducts = [
    productName,
    ...snapshots.filter((s) => s.competitor).map((s) => s.competitor.name),
  ].filter(Boolean);

  const matrix = await completeJSON({
    system: 'You build cross-product feature comparison matrices for software. Return ONLY valid JSON.',
    user: `Compare these products and extract a feature matrix.
Products that MUST appear as competitors[] entries (exact names): ${JSON.stringify(namedProducts)}
${productName ? `"${productName}" is the user's own product.` : ''}

Rules:
- features[] must be comparable across ALL products (e.g. "Cloud agents", "Team SSO", "Usage analytics", "Privacy mode"). Prefer 12-18 generic capabilities.
- Do NOT use single-vendor brand names (no "Bugbot", no product-codename features) unless the capability is industry-standard.
- For EVERY product, fill tiers[0].features as a boolean array the SAME length as features[].
- Use true/false only. Prefer false over null when the product does not offer an equivalent. Avoid null.
- Also extract pricing tiers with monthly USD when present.

Return:
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

SOURCE TEXT:
${prompt}`,
    maxTokens: 3500,
  });

  // Merge: ensure every requested rival (+ product) appears, and backfill missing
  // tiers / feature flags (matrix often drops rivals when scrapes are thin).
  const byName = new Map();
  for (const c of matrix?.competitors || []) {
    const key = String(c?.name || '').toLowerCase().trim();
    if (key) byName.set(key, c);
  }

  const featureList = Array.isArray(matrix?.features) ? matrix.features : [];

  async function extractTiers(name, content) {
    if (!content) return [];
    try {
      const result = await completeJSON({
        system: 'You extract pricing tiers from website, App Store, Play Store, or research text. Return ONLY valid JSON.',
        user: `Extract pricing tiers for "${name}". Return:
{ "tiers": [{ "name": "string", "price_monthly": number|null }] }
Use monthly USD when possible.
- If only annual/yearly is listed, divide by 12.
- If only weekly is listed, multiply by 4.33.
- Include App Store / Google Play subscription and in-app purchase tiers when present (use plan names like "Premium (App Store)" when helpful).
Only include tiers you can support from the content. Prefer real plan names (Pro, Team, Premium, etc).
Do NOT invent a "Default" tier with a null price.

CONTENT:
${String(content).slice(0, 5000)}`,
        maxTokens: 500,
      });
      const tiers = Array.isArray(result?.tiers) ? result.tiers : [];
      // Drop worthless placeholders that render as "Default —" in the UI.
      return tiers.filter((t) => {
        const nameEmpty = !t?.name || /^default$/i.test(String(t.name).trim());
        return !(nameEmpty && t?.price_monthly == null);
      });
    } catch {
      return [];
    }
  }

  async function extractFeatureFlags(name, content, features) {
    if (!content || !features.length) return null;
    try {
      const result = await completeJSON({
        system: 'You map product capabilities to a fixed feature list. Return ONLY valid JSON.',
        user: `For "${name}", mark each capability true or false from the content.
Map EQUIVALENT capabilities (e.g. "cloud agents" ≈ hosted/async agents; "team SSO" ≈ SAML/OIDC).
Features (in order): ${JSON.stringify(features)}
Return: { "flags": [true|false, ...] } with exactly ${features.length} entries.
Rules: use true/false only (no null). If content is substantial and a capability is not offered, use false.

CONTENT:
${String(content).slice(0, 5000)}`,
        maxTokens: 500,
      });
      const flags = result?.flags;
      if (!Array.isArray(flags) || flags.length !== features.length) return null;
      return flags.map((f) => (f === true ? true : false));
    } catch {
      return null;
    }
  }

  function flagCoverage(entry, n) {
    const flags = entry?.tiers?.[0]?.features;
    if (!Array.isArray(flags) || !n) return 0;
    const filled = flags.filter((f) => f === true || f === false).length;
    return filled / n;
  }

  function applyFlags(entry, flags) {
    if ((entry.tiers || []).length) {
      return {
        ...entry,
        tiers: [{ ...entry.tiers[0], features: flags }, ...entry.tiers.slice(1)],
      };
    }
    return {
      ...entry,
      tiers: [{ name: 'Plans', price_monthly: null, features: flags }],
    };
  }

  async function enrichEntry(name, content, entry, seedSources = [], competitor = null) {
    let next = { ...entry, name };
    let text = content;
    let sources = mergeSources(seedSources, entry.pricing_sources);
    const priced = () => (next.tiers || []).some((t) => t?.price_monthly != null);

    if (!contentUsefulForPricing(text)) {
      const researched = await researchPricingContent(competitor || name);
      if (researched?.content) {
        text = researched.content;
        sources = mergeSources(sources, researched.sources);
      }
    }

    if (!priced()) {
      let tiers = text ? await extractTiers(name, text) : [];
      if (tiers.length) next.tiers = tiers;
      if (!priced()) {
        // Website failed → try App Store / Play Store IAP subscriptions.
        try {
          const store = await fetchStorePricingContent(competitor || { name });
          if (store?.content && contentLooksLikeStorePricing(store.content)) {
            text = store.content;
            sources = mergeSources(sources, store.sources);
            tiers = await extractTiers(name, store.content);
            if (tiers.length) next.tiers = tiers;
            const storeUrl = store.appStore || store.playStore;
            if (storeUrl && competitor?.id && !isStoreUrl(competitor.pricing_url)) {
              try {
                await updateCompetitorPricingUrl(competitor.id, storeUrl);
                competitor.pricing_url = storeUrl;
              } catch { /* non-fatal */ }
            }
          }
        } catch {
          /* continue */
        }
      }
      if (!priced()) {
        const researched = await researchPricingContent(competitor || name);
        if (researched?.content) {
          text = researched.content;
          sources = mergeSources(sources, researched.sources);
          tiers = await extractTiers(name, researched.content);
          if (tiers.length) next.tiers = tiers;
        }
      }
    }

    // Always fill sparse/empty rival feature columns when we have source text.
    if (featureList.length && text && flagCoverage(next, featureList.length) < 0.6) {
      const flags = await extractFeatureFlags(name, text, featureList);
      if (flags) next = applyFlags(next, flags);
    }
    if (!next.tiers) next.tiers = [];
    next.pricing_sources = sources;
    if (competitor?.pricing_url) next.pricing_url = competitor.pricing_url;
    return next;
  }

  const merged = [];

  // Product column first (when includeProduct), then each requested rival.
  if (productName) {
    const key = productName.toLowerCase().trim();
    let entry = byName.get(key)
      || [...byName.values()].find((c) => {
        const ck = String(c?.name || '').toLowerCase().trim();
        return ck.includes(key) || key.includes(ck);
      })
      || { name: productName, tiers: [] };
    const product = await getProduct(req.workspaceId);
    const pc = product ? await getProductContent(product) : productEntry;
    const productSources = mergeSources(sourceFromUrl(product?.pricing_url, 'Pricing page'));
    entry = await enrichEntry(productName, pc, entry, productSources, product ? {
      name: product.name,
      website: product.website || product.pricing_url,
      pricing_url: product.pricing_url,
    } : { name: productName });
    merged.push(entry);
    byName.delete(key);
  }

  for (const { competitor, content, sources } of snapshots) {
    if (!competitor) continue;
    const key = String(competitor.name || '').toLowerCase().trim();
    if (productName && key === productName.toLowerCase().trim()) continue;
    let entry = byName.get(key)
      || [...byName.values()].find((c) => {
        const ck = String(c?.name || '').toLowerCase().trim();
        return ck.includes(key) || key.includes(ck);
      });
    if (!entry) entry = { name: competitor.name, tiers: [] };
    entry = await enrichEntry(competitor.name, content, entry, sources, competitor);
    merged.push(entry);
    byName.delete(key);
  }

  for (const c of byName.values()) merged.push(c);

  res.json({
    features: featureList,
    competitors: merged,
    productName,
  });
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
  const competitor = await getCompetitor(req.params.id, req.workspaceId);
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
  const competitor = await getCompetitor(req.params.id, req.workspaceId);
  if (!competitor) return res.status(404).json({ error: 'Not found' });

  const ensured = await ensureCompetitorContent(competitor);
  const content = ensured?.content;
  if (!content) {
    return res.json({ score: null, reasoning: null, error: 'No pricing or research content yet' });
  }

  const result = await completeJSON({
    system: 'You rate software products on value-for-money. Return ONLY valid JSON.',
    user: `Rate ${competitor.name} on value-for-money (1-10 scale).

Pricing / product content:
${content.slice(0, 5000)}

Return: { "score": number, "reasoning": "2-3 sentences on value vs price" }`,
    maxTokens: 400,
  });

  const score = typeof result?.score === 'number' ? result.score : Number(result?.score);
  const reasoning = result?.reasoning || result?.value_analysis || null;
  if (Number.isFinite(score)) {
    await insforge.database
      .from('competitors')
      .update({ value_score: score, value_analysis: reasoning })
      .eq('id', competitor.id)
      .eq('workspace_id', req.workspaceId);
  }

  res.json({
    score: Number.isFinite(score) ? score : null,
    reasoning,
    error: Number.isFinite(score) ? null : 'Could not score competitor',
  });
}));

// Review sentiment — fetch reviews via You.com Research and summarize per competitor.
router.post('/reviews', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { competitorIds } = req.body || {};
  const competitors = competitorIds?.length
    ? await Promise.all(competitorIds.map((id) => getCompetitor(id, req.workspaceId)))
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
      const attribution = makeAttribution('youcom-research', payload, { limit: 6 });
      reviews.push({
        name: c.name,
        id: c.id,
        ...(summary || { sentiment: null }),
        attribution,
        sources: attribution.sources,
        skill: attribution.skill,
        skillLabel: attribution.skillLabel,
      });
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

// Strategy — SWOT for the user's own product vs the field + per-competitor
// positioning / target-audience / messaging (closes the gap with Competely-style reports).
router.post('/strategy', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const [product, competitors] = await Promise.all([
    getProduct(req.workspaceId),
    listCompetitors('approved', req.workspaceId),
  ]);
  if (!competitors.length) return res.json({ strategy: null });

  const competitorSummaries = await Promise.all(
    competitors.map(async (c) => {
      const snap = await getLatestSnapshot(c.id);
      return `### ${c.name}${c.value_score != null ? ` (value ${c.value_score}/10)` : ''}\n${(snap?.content || '').slice(0, 1500)}`;
    })
  );

  const productContext = product
    ? `OUR PRODUCT: ${product.name}\n${product.description || ''}`
    : 'OUR PRODUCT: (not yet defined — infer from the market)';

  const strategy = await completeJSON({
    system: 'You are a product/GTM strategist. Return ONLY valid JSON. Be specific and reference real competitor names.',
    user: `${productContext}

COMPETITORS:
${competitorSummaries.join('\n\n')}

Produce strategic analysis as JSON:
{
  "swot": {
    "strengths": ["our product's real strengths vs this set"],
    "weaknesses": ["where we're behind"],
    "opportunities": ["underserved segments / market gaps we could win"],
    "threats": ["competitive/market risks to watch"]
  },
  "positioning": [
    {
      "name": "competitor name",
      "positioning": "how they position themselves, one line",
      "target_audience": "who they target (e.g. SMB, enterprise, a niche)",
      "messaging_angle": "their core marketing message / hook"
    }
  ]
}
3-5 items per SWOT list. Include every competitor in "positioning".`,
    maxTokens: 1800,
  });

  res.json({ strategy: strategy || null });
}));

// Market intelligence — uses You.com Finance Research for market size, growth
// timeline, and competitor funding/revenue. Slow (1–3 min), so it runs as a
// background job (see /market/start + /market/status below).
async function runMarketIntel(workspaceId, effort = 'deep') {
  const [product, competitors, marketModel] = await Promise.all([
    getProduct(workspaceId),
    listCompetitors('approved', workspaceId),
    getMarketModel(workspaceId),
  ]);

  const marketName = product?.description?.slice(0, 200) || product?.name || 'this market';
  const names = competitors.map((c) => c.name).slice(0, 8);

  const input = `For the market "${marketName}": estimate the total market size for the last 5 years (give a number per year if possible) and the annual growth rate (CAGR). Then for each of these companies estimate funding raised, annual revenue, valuation, and monthly website visits/traffic where known: ${names.join(', ')}. Provide concrete numbers and cite sources.`;

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
    { "name": "", "funding": "e.g. $40M or null", "revenue": "e.g. $20M est or null", "revenue_usd": 20000000, "monthly_visits": 1500000, "valuation": "or null", "review_count": 1200, "g2_rating": 4.5, "note": "one line" }
  ],
  "narrative": "a short paragraph on market dynamics and what it means for pricing/positioning"
}
Only include years/companies actually supported by the text. Use null when unknown.

FINANCE RESEARCH:
${researchText}`,
    maxTokens: 1600,
  });

  if (!structured) return null;
  const attribution = makeAttribution('youcom-finance', payload, { limit: 10 });

  // Grok returns { market: {size_current,cagr,history,summary}, companies, narrative }.
  // Flatten to the shape the UI expects (tolerating either nesting).
  const m = structured.market && typeof structured.market === 'object' ? structured.market : structured;
  const marketIntel = {
    size_current: m.size_current ?? null,
    cagr: m.cagr ?? null,
    history: Array.isArray(m.history) ? m.history : [],
    summary: m.summary ?? null,
    narrative: structured.narrative ?? null,
    sources: attribution.sources,
    attribution,
    skill: attribution.skill,
    skillLabel: attribution.skillLabel,
  };

  let companies = (Array.isArray(structured.companies) ? structured.companies : []).map((c) => ({
    ...c,
    revenue_usd: toNum(c.revenue_usd) || parseMoneyToUsd(c.revenue) || null,
    review_count: toNum(c.review_count) || null,
    g2_rating: toNum(c.g2_rating) || null,
    monthly_visits: toNum(c.monthly_visits) || null,
  }));

  const [trafficResult, syndicatedResult] = await Promise.all([
    resolveTrafficForCompetitors(competitors, { companies, researchText }),
    fetchAndExtractSyndicatedShare(marketName, names, flattenResearch),
  ]);

  const { tamUsd, tamSource } = resolveTamUsd({ marketModel, marketIntel });
  const distribution = computeMarketDistribution(companies, tamUsd, tamSource, {
    trafficByName: trafficResult.byName,
    trafficKinds: trafficResult.kinds,
    trafficMeta: trafficResult.meta,
  });
  companies = enrichCompaniesWithDistribution(companies, distribution);

  const syndicated = syndicatedResult.syndicated;
  const syndicatedTable = syndicated
    ? buildSyndicatedTable(syndicated, distribution, names)
    : null;
  const syndicatedPayload = syndicated
    ? { ...syndicated, table: syndicatedTable }
    : null;

  // Pulse vs previous snapshot.
  let pulse = { shifts: [], summary: 'First market distribution snapshot.' };
  try {
    const prevRaw = await getSetting(distributionSnapshotKey(workspaceId));
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    if (prev?.items?.length) pulse = diffDistribution(prev, distribution);
    if (prevRaw) {
      await setSetting(`${distributionSnapshotKey(workspaceId)}:prev`, prevRaw).catch(() => {});
    }
  } catch { /* ignore corrupt snapshot */ }

  await setSetting(
    distributionSnapshotKey(workspaceId),
    JSON.stringify({
      ...distribution,
      syndicated: syndicatedPayload,
      captured_at: new Date().toISOString(),
    })
  ).catch(() => {});

  if (syndicatedPayload) {
    await setSetting(syndicatedSnapshotKey(workspaceId), JSON.stringify(syndicatedPayload)).catch(() => {});
  }

  const significantShifts = getSignificantShifts(pulse);
  if (significantShifts.length) {
    const line = significantShifts
      .slice(0, 3)
      .map((s) => `${s.name} ${s.delta_pct > 0 ? '+' : ''}${s.delta_pct}pp`)
      .join(' · ');
    sendPushToWorkspace(
      workspaceId,
      {
        title: 'Significant market shift',
        body: line.slice(0, 180),
        url: '/distribution',
        tag: `market-shift-${workspaceId}`,
      },
      'market'
    ).catch(() => {});
    sendMarketShiftWebhook(workspaceId, significantShifts, distribution.method).catch(() => {});
  }

  return {
    ...marketIntel,
    companies,
    distribution,
    syndicated: syndicatedPayload,
    pulse,
    signals: {
      traffic_configured: trafficResult.meta?.configured,
      traffic_fetched: trafficResult.meta?.research ?? trafficResult.meta?.total ?? 0,
      traffic_meta: trafficResult.meta,
    },
  };
}

// Start a background market-intelligence job; returns immediately with a jobId.
router.post('/market/start', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const effort = req.body?.effort === 'exhaustive' ? 'exhaustive' : 'deep';
  const workspaceId = req.workspaceId;
  const jobId = await createJob({ workspaceId, userId: req.user.id, type: 'market' });

  // Run without blocking the response.
  runMarketIntel(workspaceId, effort)
    .then(async (market) => {
      await completeJob(jobId, { market });
      const pulseLine = market?.pulse?.shifts?.length
        ? ` ${market.pulse.summary}`
        : '';
      sendPushToWorkspace(workspaceId, {
        title: 'Market intelligence ready',
        body: `Your market research is ready.${pulseLine}`.slice(0, 180),
        url: '/distribution',
        tag: `market-${jobId}`,
      }, 'any').catch(() => {});
    })
    .catch((err) => {
      console.error(`[market job ${jobId}] failed:`, err.message);
      failJob(jobId, err.message);
    });

  res.json({ jobId });
}));

// Poll a market-intelligence job.
router.get('/market/status/:jobId', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job || String(job.workspace_id) !== String(req.workspaceId)) {
    return res.status(404).json({ error: 'Job not found or expired', code: 'JOB_NOT_FOUND' });
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Latest market pulse for the workspace (distribution snapshot + recent pricing changes).
router.get('/market-pulse', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const workspaceId = req.workspaceId;
  let distribution = null;
  try {
    const raw = await getSetting(distributionSnapshotKey(workspaceId));
    distribution = raw ? JSON.parse(raw) : null;
  } catch { /* ignore */ }

  const marketModel = await getMarketModel(workspaceId);
  let syndicated = distribution?.syndicated ?? null;
  if (!syndicated) {
    try {
      const raw = await getSetting(syndicatedSnapshotKey(workspaceId));
      syndicated = raw ? JSON.parse(raw) : null;
    } catch { /* ignore */ }
  }
  const insights = generateMarketInsights(marketModel, distribution, syndicated);

  const weekAgo = Date.now() - 7 * 86400 * 1000;
  const changes = (await listRecentChanges(30, workspaceId)).filter(
    (c) => new Date(c.detected_at).getTime() >= weekAgo
  );

  let pulse = null;
  if (distribution?.items?.length) {
    try {
      const prevRaw = await getSetting(`${distributionSnapshotKey(workspaceId)}:prev`);
      const prev = prevRaw ? JSON.parse(prevRaw) : null;
      if (prev?.items?.length) pulse = diffDistribution(prev, distribution);
    } catch { /* ignore */ }
  }

  res.json({
    distribution: distribution
      ? {
          method: distribution.method,
          items: distribution.items,
          cr4_pct: distribution.cr4_pct,
          remainder_pct: distribution.remainder_pct,
          tam_source: distribution.tam_source,
          signal_counts: distribution.signal_counts,
          traffic_meta: distribution.traffic_meta,
          captured_at: distribution.captured_at,
          disclaimer: distribution.disclaimer,
        }
      : null,
    syndicated: syndicated
      ? {
          market_definition: syndicated.market_definition,
          year: syndicated.year,
          vendors: syndicated.vendors,
          table: syndicated.table,
          notes: syndicated.notes,
          disclaimer: syndicated.disclaimer,
          captured_at: syndicated.captured_at,
        }
      : null,
    insights,
    pulse: pulse
      ? {
          shifts: pulse.shifts,
          significant: getSignificantShifts(pulse),
          summary: pulse.summary,
        }
      : null,
    pricing_changes_7d: changes.length,
    recent_changes: changes.slice(0, 5).map((c) => ({
      competitor_name: c.competitor_name,
      summary: c.summary,
      detected_at: c.detected_at,
    })),
  });
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

// ---------------------------------------------------------------------------
// TAM / SAM / SOM market model
// ---------------------------------------------------------------------------

function toNum(v, d = null) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.eE+-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return d;
}
const clamp01 = (v, d) => Math.min(1, Math.max(0, toNum(v, d)));

// Normalize/guard the editable assumptions.
function normalizeInputs(inp = {}) {
  return {
    geography: typeof inp.geography === 'string' && inp.geography.trim() ? inp.geography.trim() : 'Global',
    serviceable_pct: clamp01(inp.serviceable_pct, 0.3),
    acv_usd: Math.max(0, toNum(inp.acv_usd, 1200)),
    target_share: clamp01(inp.target_share, 0.02),
    timeframe_years: Math.min(7, Math.max(1, Math.round(toNum(inp.timeframe_years, 3)))),
    annual_growth_pct: clamp01(inp.annual_growth_pct, 0.3),
  };
}

// Deterministic SAM/SOM/timeline from TAM + editable inputs. This is the math
// that recomputes instantly when a founder edits an assumption — no tokens.
// SOM scales with your pricing relative to the baseline ACV, so raising ACV
// (a real lever) increases obtainable revenue. SAM stays a pure market figure.
function computeDerived(tamValue, inputs, baseAcv) {
  const tam = Math.max(0, toNum(tamValue, 0));
  const sam = Math.round(tam * inputs.serviceable_pct);
  const acvFactor = baseAcv > 0 ? Math.max(0, inputs.acv_usd) / baseAcv : 1;
  const som = Math.round(sam * inputs.target_share * acvFactor);
  const T = inputs.timeframe_years;
  const som_timeline = Array.from({ length: T }, (_, i) => ({
    year: i + 1,
    value_usd: Math.round(som * ((i + 1) / T)),
  }));
  return { sam, som, som_timeline };
}

// Assemble the full model object the UI renders (TAM from research, SAM/SOM derived).
function buildModel(structured, sources) {
  const inputs = normalizeInputs(structured.inputs);
  const tamValue = toNum(structured?.tam?.value_usd, 0);
  const { sam, som, som_timeline } = computeDerived(tamValue, inputs, inputs.acv_usd);

  // Keep the bottom-up cross-check consistent with the model's ACV lever, so
  // editing ACV updates it and it can't contradict the funnel ($1K vs $1200).
  let bottom_up = null;
  if (structured?.bottom_up) {
    const customers = toNum(structured.bottom_up.customers);
    bottom_up = {
      ...structured.bottom_up,
      acv_usd: inputs.acv_usd,
      value_usd: customers != null ? Math.round(customers * inputs.acv_usd) : toNum(structured.bottom_up.value_usd),
    };
  }

  return {
    category: structured?.category || null,
    icp: structured?.icp || null,
    tam: {
      value_usd: tamValue,
      low_usd: toNum(structured?.tam?.low_usd),
      high_usd: toNum(structured?.tam?.high_usd),
      confidence: structured?.tam?.confidence || 'low',
      sourced: structured?.tam?.sourced === true,
      source_quote: structured?.tam?.source_quote || null,
      method: structured?.tam?.method || null,
    },
    sam: { value_usd: sam, method: 'TAM × serviceable %', confidence: structured?.tam?.confidence || 'low' },
    som: { value_usd: som, method: 'SAM × target share' },
    som_timeline,
    bottom_up,
    reconciliation: structured?.reconciliation || null,
    inputs,
    inputs_base: { ...inputs },
    levers: Array.isArray(structured?.levers) ? structured.levers.slice(0, 6) : [],
    summary: structured?.summary || null,
    sources,
    generatedAt: new Date().toISOString(),
  };
}

// Build-time self-verify: independently cross-check the TAM (Tavily, a different
// pipeline than the You.com build) and return a sourced figure to correct toward.
async function verifyTam({ category, geography, tamValue }) {
  let evidence = '';
  let engine = '';
  if (tavilyConfigured()) {
    try {
      const tv = await tavilySearch(`${category} market size TAM${geography ? ` ${geography}` : ''}`.slice(0, 380), { maxResults: 6 });
      if (tv) { evidence = [tv.answer, ...tv.results.map((r) => `${r.title} — ${r.content}`)].join('\n').slice(0, 8000); engine = 'tavily'; }
    } catch { /* fall through */ }
  }
  if (!evidence) return null;
  const judged = await completeJSON({
    system: 'You verify a market-size figure strictly against the research provided. Return ONLY valid JSON.',
    user: `Claimed TAM for "${category}"${geography ? ` in ${geography}` : ''}: ${fmtUsdServer(tamValue) || tamValue}.

Research:
${evidence}

Return JSON: { "supported": true|false, "suggested_tam_usd": <number or null>, "source_quote": "the figure/quote that supports it, or null" }
"supported" = the research corroborates the order of magnitude. If a clearer, better-scoped TAM figure exists, put it in "suggested_tam_usd"; else null.`,
    maxTokens: 400,
  });
  return judged ? { ...judged, engine } : null;
}

// Research + structure a fresh TAM/SAM/SOM model for the workspace's product.
async function runMarketModel(workspaceId) {
  const product = await getProduct(workspaceId);
  if (!product) {
    const err = new Error('Add your product first, then build the market model.');
    err.code = 'NO_PRODUCT';
    throw err;
  }
  const name = product.name || 'this product';
  const desc = (product.description || '').slice(0, 700);
  const pricing = typeof product.pricing_data === 'string' ? product.pricing_data.slice(0, 800) : '';

  // Step 0 — pin the market definition (cheap, no research) so the build and the
  // fact-check search the SAME market. Category drift is the #1 cause of a model
  // whose numbers can't be corroborated ("false unsupported").
  const framing = await completeJSON({
    system: "You define a startup's market precisely and concisely. Return ONLY valid JSON.",
    user: `Product: "${name}"
What it does: ${desc}
Pricing: ${pricing}
Return JSON: { "category": "the specific market/category this competes in (e.g. 'running coaching apps')", "icp": "ideal customer in a few words", "geography": "primary geography, or Global" }`,
    maxTokens: 250,
  });
  const category = (framing?.category || name).slice(0, 120);
  const icp = (framing?.icp || 'target customers').slice(0, 120);
  const geography = (framing?.geography || 'Global').slice(0, 60);

  const input = `Market-sizing research for the "${category}" market in ${geography}.
Ideal customer: ${icp}.
Product context: "${name}" — ${desc}

Find, with concrete numbers and cited sources:
1. The total addressable market (TAM) in USD for the "${category}" market, plus its annual growth rate (CAGR).
2. The size of the potential customer pool — how many ${icp} exist in ${geography}.
3. A typical annual spend per customer for "${category}".
Cite sources for each figure.`;

  const payload = await financeResearch(input, 'deep');
  const text = flattenResearch(payload).slice(0, 12000);
  if (!text) return null;
  const attribution = makeAttribution('youcom-finance', payload, { limit: 10 });
  const sources = attribution.sources;

  const structured = await completeJSON({
    system:
      'You are a rigorous market-sizing analyst. CRITICAL RULE: set "sourced": true for a figure ONLY if that number actually appears in the research text; otherwise put your best estimate and set "sourced": false. Never label an estimate as sourced, never invent a precise figure and call it sourced, and never put unsourced specific numbers in the summary. Prefer null over guessing. Return ONLY valid JSON.',
    user: `Build a TAM/SAM/SOM model for the "${category}" market (ideal customer: ${icp}, geography: ${geography}).

Return JSON exactly in this shape:
{
  "category": "${category}",
  "icp": "${icp}",
  "tam": {
    "value_usd": 4200000000,
    "low_usd": 3000000000, "high_usd": 6000000000,
    "confidence": "low|medium|high",
    "sourced": true,
    "source_quote": "the figure/quote from the research that supports this, or null if estimated",
    "method": "one line: how derived + which source"
  },
  "bottom_up": {
    "customers": 500000, "customers_sourced": true,
    "acv_usd": 1200, "acv_sourced": false,
    "value_usd": 600000000,
    "note": "one line"
  },
  "reconciliation": "2-3 sentences comparing the top-down TAM with the bottom-up (customers x ACV). If they diverge a lot, say why.",
  "inputs": {
    "geography": "${geography}",
    "serviceable_pct": 0.3, "acv_usd": 1200, "target_share": 0.02,
    "timeframe_years": 3, "annual_growth_pct": 0.3
  },
  "levers": [
    { "lever": "action to take", "target_layer": "SAM|SOM|ACV", "effect": "what it moves", "requires": "what it takes",
      "impact": { "input": "serviceable_pct|target_share|acv_usd", "to": 0.45 } }
  ],
  "summary": "2-3 sentence plain-English read. Only mention specific numbers that are sourced=true."
}
Provide 3 to 5 DISTINCT levers: include at least one that grows SAM (raises serviceable_pct), one that grows SOM (raises target_share), and one that grows ACV (raises acv_usd). Each impact.to must be a realistic improvement that is clearly HIGHER than the corresponding value you set in "inputs" (never equal to it).
Use USD numbers (not strings). ACV is the founder's pricing lever, so acv_sourced is usually false — that's fine.

RESEARCH:
${text}`,
    maxTokens: 2000,
  });

  if (!structured?.tam) return null;
  const model = buildModel(structured, sources);
  model.category = model.category || category;
  model.icp = model.icp || icp;
  model.attribution = attribution;
  model.skill = attribution.skill;
  model.skillLabel = attribution.skillLabel;
  model.engine = attribution.engine;

  // Build-time self-verify: cross-check TAM and auto-correct toward the sourced
  // figure, so the first render is already grounded (no manual Apply needed).
  try {
    const v = await verifyTam({ category: model.category, geography, tamValue: model.tam.value_usd });
    if (v) {
      const suggested = toNum(v.suggested_tam_usd);
      const current = model.tam.value_usd;
      if (suggested && current && Math.abs(suggested - current) / current > 0.15) {
        model.tam.value_usd = suggested;
        model.tam.sourced = true;
        model.tam.confidence = 'medium';
        model.tam.source_quote = v.source_quote || model.tam.source_quote;
        model.tam.method = 'Cross-checked and adjusted to a sourced figure at build time';
        model.tam_autocorrected = true;
        const d = computeDerived(suggested, model.inputs, model.inputs_base.acv_usd);
        model.sam.value_usd = d.sam;
        model.som.value_usd = d.som;
        model.som_timeline = d.som_timeline;
      } else if (v.supported) {
        model.tam.sourced = true;
        if (v.source_quote && !model.tam.source_quote) model.tam.source_quote = v.source_quote;
      }
    }
  } catch (err) {
    console.error('[market-model] TAM self-verify skipped:', err.message);
  }

  return model;
}

// --- Fact-check: independently re-research the model's claims and judge each ---
function fmtUsdServer(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

async function runFactCheck(workspaceId) {
  const model = await getMarketModel(workspaceId);
  if (!model) {
    const err = new Error('Build a market model first, then fact-check it.');
    err.code = 'NO_MODEL';
    throw err;
  }
  const product = await getProduct(workspaceId);
  const name = product?.name || 'this product';

  // Typed claims: only 'market' claims are verifiable in sources. 'assumption'
  // (derived) and 'input' (your pricing lever) are not expected to appear online.
  const claimDefs = [];
  const tamStr = fmtUsdServer(model.tam?.value_usd);
  if (tamStr) claimDefs.push({ text: `The total addressable market (TAM) is approximately ${tamStr}.`, kind: 'market' });
  if (model.bottom_up?.customers) claimDefs.push({ text: `There are roughly ${Number(model.bottom_up.customers).toLocaleString()} potential customers matching the ideal customer profile.`, kind: 'assumption' });
  const acvStr = fmtUsdServer(model.bottom_up?.acv_usd || model.inputs?.acv_usd);
  if (acvStr) claimDefs.push({ text: `The typical annual value per customer (ACV) is around ${acvStr}.`, kind: 'input' });
  if (model.summary) claimDefs.push({ text: `Market read: ${model.summary}`, kind: 'market' });

  // Distribution presence claims (Phase 3 fact-check extension).
  try {
    const distRaw = await getSetting(distributionSnapshotKey(workspaceId));
    const dist = distRaw ? JSON.parse(distRaw) : null;
    const top = dist?.items?.[0];
    if (top && (top.presence_pct ?? top.share_pct)) {
      const pct = top.presence_pct ?? top.share_pct;
      claimDefs.push({
        text: `${top.name} has approximately ${pct}% estimated market presence among tracked competitors in this category.`,
        kind: 'market',
      });
    }
    if (dist?.cr4_pct != null) {
      claimDefs.push({
        text: `The top four competitors combined hold roughly ${dist.cr4_pct}% of estimated market presence (CR4).`,
        kind: 'market',
      });
    }
  } catch { /* ignore */ }

  if (!claimDefs.length) return null;
  const claims = claimDefs.map((c) => c.text);

  const geo = model.inputs?.geography ? ` in ${model.inputs.geography}` : '';

  // Independent retrieval: Tavily (a different pipeline than You.com, which built
  // the model) so this is a real cross-check. Falls back to You.com if no key/error.
  // Tavily caps queries at ~400 chars, so use short focused queries (not the full claims).
  let evidence = '';
  let sources = [];
  let engine = '';
  if (tavilyConfigured()) {
    try {
      const cat = model.category || name;
      const icp = model.icp || 'target customers';
      const queries = [`${cat} market size TAM growth${geo}`];
      if (model.bottom_up?.customers) queries.push(`number of ${icp}${geo}`);
      if (acvStr) queries.push(`${cat} typical annual price per customer`);
      const results = (await Promise.all(
        queries.slice(0, 3).map((q) => tavilySearch(q.slice(0, 380), { maxResults: 5 }).catch(() => null))
      )).filter(Boolean);
      if (results.length) {
        const parts = [];
        const seen = new Set();
        for (const r of results) {
          if (r.answer) parts.push(r.answer);
          for (const it of r.results) {
            if (!it.url || seen.has(it.url)) continue;
            seen.add(it.url);
            parts.push(`${it.title} — ${it.url}\n${it.content}`);
            if (sources.length < 10) sources.push({ title: it.title, url: it.url });
          }
        }
        evidence = parts.join('\n\n').slice(0, 12000);
        if (evidence) engine = 'tavily';
      }
    } catch (err) {
      console.error('[fact-check] Tavily failed, falling back:', err.message);
    }
  }
  // Cheap you-web pass before expensive finance_research.
  if (!evidence) {
    try {
      const cat = model.category || name;
      const icp = model.icp || 'target customers';
      const queries = [`${cat} market size TAM growth${geo}`];
      if (model.bottom_up?.customers) queries.push(`number of ${icp}${geo}`);
      if (acvStr) queries.push(`${cat} typical annual price per customer`);
      const results = (await Promise.all(
        queries.slice(0, 3).map((q) => webSearch(q.slice(0, 380), { count: 6 }).catch(() => null))
      )).filter((r) => r?.text);
      if (results.length) {
        const parts = [];
        const seen = new Set();
        for (const r of results) {
          if (r.text) parts.push(r.text);
          for (const it of r.sources || []) {
            if (!it.url || seen.has(it.url)) continue;
            seen.add(it.url);
            if (sources.length < 10) sources.push({ title: it.title, url: it.url });
          }
        }
        evidence = parts.join('\n\n').slice(0, 12000);
        if (evidence) engine = results[0]?.engine || 'youcom-search';
      }
    } catch (err) {
      console.error('[fact-check] you-web pass failed, falling back to finance:', err.message);
    }
  }
  if (!evidence) {
    const payload = await financeResearch(`Independently verify these claims about "${name}"${geo}: ${claims.join(' ')}. Provide concrete numbers and cite sources.`, 'deep');
    evidence = flattenResearch(payload).slice(0, 12000);
    sources = (payload?.output?.sources || []).slice(0, 8).map((s) => ({ title: s.title, url: s.url }));
    engine = 'youcom-fallback';
  }
  if (!evidence) return null;

  const structured = await completeJSON({
    system: 'You are a skeptical, independent fact-checker. Judge each claim strictly against the research provided. Return ONLY valid JSON.',
    user: `Claims to verify for "${name}":
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Independent research:
${evidence}

Return JSON:
{
  "checks": [
    { "claim": "restate the claim briefly", "verdict": "supported|mixed|unsupported", "finding": "what the research actually says, with a number if available", "confidence": "low|medium|high" }
  ],
  "suggested_tam_usd": <number or null>,
  "overall": "one-line judgement of the model's overall reliability"
}
Rules: "supported" only if the research corroborates the figure or its order of magnitude; "mixed" if partial, dated, or uncertain; "unsupported" if the research conflicts or nothing relevant was found. One check per claim, in order. For "suggested_tam_usd": if the sources point to a clearer TAM figure than the model's, give that number in USD; otherwise null.`,
    maxTokens: 1600,
  });

  if (!structured?.checks) return null;
  // Attach the claim type back to each verdict (judge returns them in order).
  const checks = structured.checks.slice(0, 8).map((c, i) => ({ ...c, kind: claimDefs[i]?.kind || 'market' }));

  // Bottom-up sanity: if the bottom-up estimate dwarfs the sourced TAM, the
  // customer count / ACV assumptions are likely too optimistic — flag it.
  const bu = toNum(model.bottom_up?.value_usd);
  const tamVal = toNum(model.tam?.value_usd);
  if (bu && tamVal && bu > tamVal * 3) {
    checks.push({
      claim: 'Bottom-up vs sourced TAM',
      verdict: 'unsupported',
      finding: `Your bottom-up (${fmtUsdServer(bu)}) is ${(bu / tamVal).toFixed(1)}× the sourced TAM (${fmtUsdServer(tamVal)}). Your customer count or ACV is likely too optimistic — lower one of them.`,
      confidence: 'high',
      kind: 'assumption',
    });
  }

  const attribution = makeAttribution(
    engine === 'tavily' ? 'tavily' : engine || 'youcom-finance',
    sources,
    { limit: 10 }
  );

  return {
    checks,
    overall: structured.overall || null,
    suggested_tam_usd: toNum(structured.suggested_tam_usd) || null,
    sources: attribution.sources.length ? attribution.sources : sources,
    engine,
    attribution,
    skill: attribution.skill,
    skillLabel: attribution.skillLabel,
    checkedAt: new Date().toISOString(),
  };
}

router.post('/market-model/fact-check/start', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const workspaceId = req.workspaceId;
  const jobId = await createJob({ workspaceId, userId: req.user.id, type: 'fact-check' });

  runFactCheck(workspaceId)
    .then(async (factCheck) => {
      if (factCheck) {
        const model = await getMarketModel(workspaceId);
        if (model) {
          const product = await getProduct(workspaceId);
          await saveMarketModel(workspaceId, product?.id, { ...model, fact_check: factCheck });
        }
      }
      await completeJob(jobId, { factCheck });
      sendPushToWorkspace(workspaceId, {
        title: 'Fact-check ready',
        body: 'Your market model has been independently verified — open it to review.',
        url: '/market',
        tag: `factcheck-${jobId}`,
      }, 'any').catch(() => {});
    })
    .catch((err) => {
      console.error(`[fact-check job ${jobId}] failed:`, err.message);
      failJob(jobId, err.message);
    });

  res.json({ jobId });
}));

router.get('/market-model/fact-check/status/:jobId', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job || String(job.workspace_id) !== String(req.workspaceId)) {
    return res.status(404).json({ error: 'Job not found or expired', code: 'JOB_NOT_FOUND' });
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Start a background market-model job.
router.post('/market-model/start', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const workspaceId = req.workspaceId;
  const jobId = await createJob({ workspaceId, userId: req.user.id, type: 'market-model' });

  runMarketModel(workspaceId)
    .then(async (model) => {
      if (model) {
        const product = await getProduct(workspaceId);
        await saveMarketModel(workspaceId, product?.id, model);
        await insertModelHistory(workspaceId, product?.id, model).catch(() => {});
      }
      await completeJob(jobId, { model });
      sendPushToWorkspace(workspaceId, {
        title: 'Market model ready',
        body: 'Your TAM / SAM / SOM model has finished — open it to explore.',
        url: '/market',
        tag: `market-model-${jobId}`,
      }, 'any').catch(() => {});
    })
    .catch((err) => {
      console.error(`[market-model job ${jobId}] failed:`, err.message);
      failJob(jobId, err.message);
    });

  res.json({ jobId });
}));

router.get('/market-model/status/:jobId', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job || String(job.workspace_id) !== String(req.workspaceId)) {
    return res.status(404).json({ error: 'Job not found or expired', code: 'JOB_NOT_FOUND' });
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Load the saved model.
router.get('/market-model', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const model = await getMarketModel(req.workspaceId);
  res.json({ model: model || null });
}));

// Snapshot history for change tracking (latest first).
router.get('/market-model/history', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const history = await getModelHistory(req.workspaceId, 6);
  res.json({ history });
}));

// Recompute SAM/SOM from edited assumptions (fast, deterministic, no research)
// and persist. Body: { inputs: {...} }.
router.put('/market-model', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const saved = await getMarketModel(req.workspaceId);
  if (!saved) return res.status(404).json({ error: 'No market model yet. Build one first.', code: 'NO_MODEL' });

  const inputs = normalizeInputs({ ...saved.inputs, ...(req.body?.inputs || {}) });
  const baseAcv = saved.inputs_base?.acv_usd || saved.inputs?.acv_usd || inputs.acv_usd;

  // Optional: apply a fact-check-sourced TAM (from the verifier), then recompute.
  const overrideTam = req.body?.tam_value_usd != null ? Math.max(0, toNum(req.body.tam_value_usd, saved.tam?.value_usd)) : null;
  const tamValue = overrideTam ?? saved.tam?.value_usd;
  const tam = overrideTam != null
    ? { ...saved.tam, value_usd: tamValue, sourced: true, confidence: 'medium', method: 'Adjusted to fact-check sourced figure' }
    : saved.tam;

  const { sam, som, som_timeline } = computeDerived(tamValue, inputs, baseAcv);

  // Keep the bottom-up in sync with the current ACV, and optionally reconcile the
  // customer count so bottom-up ≈ sourced TAM (fixes an over-optimistic blowout).
  let bottom_up = saved.bottom_up;
  if (bottom_up) {
    let customers = toNum(bottom_up.customers);
    let note = bottom_up.note;
    let customersSourced = bottom_up.customers_sourced;
    if (req.body?.reconcile_bottom_up && tamValue > 0 && inputs.acv_usd > 0) {
      customers = Math.round(tamValue / inputs.acv_usd);
      customersSourced = false;
      note = 'Reconciled: customer count set so the bottom-up matches the sourced TAM.';
    }
    bottom_up = {
      ...bottom_up,
      customers,
      customers_sourced: customersSourced,
      acv_usd: inputs.acv_usd,
      value_usd: customers != null ? Math.round(customers * inputs.acv_usd) : toNum(bottom_up.value_usd),
      note,
    };
  }

  const model = {
    ...saved,
    tam,
    inputs,
    bottom_up,
    sam: { ...saved.sam, value_usd: sam },
    som: { ...saved.som, value_usd: som },
    som_timeline,
    updatedAt: new Date().toISOString(),
  };

  const product = await getProduct(req.workspaceId);
  await saveMarketModel(req.workspaceId, product?.id, model);
  res.json({ model });
}));

// Latest full analysis snapshot for the Analysis page (auto-restored on revisit).
router.get('/analysis-latest', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const result = await getWorkspaceJson(req.workspaceId, 'analysis-latest', null);
  res.json({ result });
}));

router.put('/analysis-latest', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const content = req.body?.content;
  if (!content || typeof content !== 'object') {
    return res.status(400).json({ error: 'content object required' });
  }
  const packed = {
    ...content,
    savedAt: new Date().toISOString(),
  };
  await setWorkspaceJson(req.workspaceId, 'analysis-latest', packed);
  res.json({ result: packed });
}));

export default router;
