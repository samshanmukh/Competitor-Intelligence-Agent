/**
 * Public landing-page demo: discover competitors from a pricing URL and
 * return entry price + value score points for a positioning map.
 * Does not persist to a workspace.
 */

import { discoverCompetitors } from '../agents/discoveryAgent.js';
import { fetchContents } from './youcom.js';
import { completeJSON } from './ai.js';
import { fetchStorePricingContent } from './storePricing.js';

const MAX_RIVALS = 6;

function normalizeUrl(u) {
  if (!u) return null;
  const t = String(u).trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
    const url = new URL(withProto);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'Your product';
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function contentUseful(text) {
  const t = String(text || '');
  if (t.length < 120) return false;
  return /\$|price|pricing|plan|subscription|\/mo|month|tier|free|pro|enterprise/i.test(t);
}

function entryPrice(tiers) {
  const prices = (tiers || [])
    .map((t) => t.price_monthly)
    .filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

async function enrichCompany({ name, website, pricing_url }) {
  const url = normalizeUrl(pricing_url) || normalizeUrl(website);
  if (!url) {
    return {
      name: name || 'Unknown',
      website: website || null,
      pricing_url: null,
      entry_price: null,
      value_score: null,
      tiers: [],
      error: 'No URL',
    };
  }

  let content = '';
  try {
    const map = await fetchContents([url]);
    content = map[url]?.markdown || map[url]?.text || '';
  } catch {
    content = '';
  }

  if (!contentUseful(content)) {
    try {
      const store = await fetchStorePricingContent({
        name: name || hostnameOf(url),
        website: website || originOf(url),
        pricing_url: url,
      });
      if (store?.content) content = `${content}\n\n${store.content}`.trim();
    } catch {
      /* optional */
    }
  }

  if (!contentUseful(content)) {
    return {
      name: name || hostnameOf(url),
      website: website || originOf(url),
      pricing_url: url,
      entry_price: null,
      value_score: null,
      tiers: [],
      error: 'Could not read pricing content',
    };
  }

  const displayName = name || hostnameOf(url);
  let result = null;
  try {
    result = await completeJSON({
      system: 'You extract software pricing and rate value-for-money. Return ONLY valid JSON.',
      user: `Analyze "${displayName}" from this pricing/product content.
Return:
{
  "name": "best product/company name",
  "tiers": [{ "name": "string", "price_monthly": number|null }],
  "value_score": number,
  "value_analysis": "1-2 sentences"
}
Rules:
- value_score is 1–10 value for money.
- price_monthly in USD; convert yearly÷12, weekly×4.33.
- Include App Store / Play Store subscription tiers when present.
- Only use prices present in the content. Prefer real plan names.

CONTENT:
${content.slice(0, 5000)}`,
      maxTokens: 700,
    });
  } catch {
    result = null;
  }

  const tiers = Array.isArray(result?.tiers) ? result.tiers : [];
  const scoreRaw = result?.value_score ?? result?.score;
  const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);

  return {
    name: (result?.name || displayName).trim(),
    website: website || originOf(url),
    pricing_url: url,
    entry_price: entryPrice(tiers),
    value_score: Number.isFinite(score) ? Math.max(1, Math.min(10, score)) : null,
    value_analysis: result?.value_analysis || null,
    tiers,
    error: null,
  };
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

/**
 * @param {string} pricingUrl
 * @returns {Promise<{ market: string, you: object, rivals: object[] }>}
 */
export async function buildDemoPositioningMap(pricingUrl) {
  const url = normalizeUrl(pricingUrl);
  if (!url) {
    const err = new Error('Enter a valid product or pricing URL (https://…).');
    err.code = 'INVALID_URL';
    throw err;
  }

  const { market, candidates } = await discoverCompetitors({
    productUrl: url,
    maxResults: 10,
  });

  const youHost = hostnameOf(url).toLowerCase();
  const rivals = (candidates || [])
    .filter((c) => {
      const host = hostnameOf(c.pricing_url || c.website || '').toLowerCase();
      return host && host !== youHost;
    })
    .slice(0, MAX_RIVALS);

  const youPromise = enrichCompany({
    name: hostnameOf(url),
    website: originOf(url),
    pricing_url: url,
  });

  const rivalRows = await mapPool(rivals, 3, (c) =>
    enrichCompany({
      name: c.name,
      website: c.website,
      pricing_url: c.pricing_url,
    }).catch(() => ({
      name: c.name,
      website: c.website,
      pricing_url: c.pricing_url,
      entry_price: null,
      value_score: null,
      tiers: [],
      error: 'Enrichment failed',
    }))
  );

  const you = await youPromise;

  return {
    market: market || `Competitors for ${hostnameOf(url)}`,
    you: { ...you, isYou: true },
    rivals: rivalRows,
  };
}
