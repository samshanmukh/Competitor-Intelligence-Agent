/**
 * Landing-page fast competitors + pricing path.
 * Target wall clock <20s. Uses 1× webSearch, 1× Grok extract, 1× batched
 * fetchContents, and optional 1× Grok price batch — never research() /
 * discoverCompetitors / store enrichment / financeResearch.
 */

import { webSearch, fetchContents, flattenYouPayload } from './youcom.js';
import { completeJSON } from './ai.js';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const WALL_MS = 18000;
const SEARCH_TIMEOUT_MS = 8000;
const CONTENTS_TIMEOUT_MS = 9000;
const MAX_RIVALS = 4;
/** Cap contents batch so You.com can finish inside the wall clock (you + up to 4 rivals). */
const MAX_CONTENT_URLS = 5;
const CACHE_PREFIX = 'demo:fast:v3:';

/** @type {Map<string, { expires: number, payload: object }>} */
const cache = new Map();

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
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function cacheKeyFor(url) {
  const host = hostnameOf(url);
  return host ? `${CACHE_PREFIX}${host}` : null;
}

function getCached(key) {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() > row.expires) {
    cache.delete(key);
    return null;
  }
  return row.payload;
}

function setCached(key, payload) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });
}

/**
 * Prefer the lowest plausible monthly entry price from markdown.
 * Returns a number (USD/mo) or null.
 */
export function scrapeEntryPrice(markdown) {
  const text = String(markdown || '');
  if (!text.trim()) return null;

  const prices = [];
  const re = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const amount = Number(String(m[1]).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 50000) continue;

    const after = text.slice(m.index, m.index + m[0].length + 48).toLowerCase();
    const before = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
    const ctx = `${before} ${after}`;

    // Skip obvious non-plan noise
    if (/\/\s*user|per\s+seat|seat|employee|mau|credit/i.test(ctx) && !/\/\s*mo|month|\/mo\b/i.test(ctx)) {
      // keep if clearly monthly elsewhere; otherwise skip seat pricing noise
      if (!/month|\/\s*mo|\/mo\b|billed/i.test(ctx)) continue;
    }

    let monthly = amount;
    if (/\/\s*yr|\/\s*year|per\s+year|annually|\/year\b/i.test(after) || /\/yr\b/i.test(after)) {
      monthly = Math.round((amount / 12) * 100) / 100;
    } else if (/\/\s*wk|\/\s*week|per\s+week|weekly/i.test(after)) {
      monthly = Math.round((amount * 4.33) * 100) / 100;
    } else if (/\/\s*mo|\/mo\b|per\s+month|monthly|\/month/i.test(after)) {
      monthly = amount;
    } else if (amount >= 200 && /year|annual|billed yearly/i.test(ctx)) {
      monthly = Math.round((amount / 12) * 100) / 100;
    }

    // Prefer plan-looking amounts under a few hundred /mo
    if (monthly > 0 && monthly <= 2000) prices.push(monthly);
  }

  if (!prices.length) return null;
  return Math.min(...prices);
}

function contentUseful(text) {
  const t = String(text || '');
  if (t.length < 80) return false;
  return /\$|price|pricing|plan|subscription|\/mo|month|tier|free|pro|enterprise/i.test(t);
}

/**
 * Cheap demo value axis so the chart can always plot you + rivals.
 * Priced rows get a relative score (cheaper → higher). Unpriced rows still
 * get a mid heuristic so they appear on the map (client marks them muted).
 */
export function withHeuristicValueScores(you, rivals) {
  const list = rivals || [];
  const priced = [you, ...list].filter((r) => r && r.entry_price != null);
  const prices = priced.map((r) => r.entry_price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const scoreFromPrice = (price) => {
    if (prices.length < 2) return null;
    const t = max === min ? 0.5 : (max - price) / (max - min);
    return Math.round((4 + t * 4) * 10) / 10; // 4–8, cheaper → higher
  };

  const scoreRow = (r, isYou) => {
    if (!r) return r;
    if (r.value_score != null && Number.isFinite(Number(r.value_score))) {
      return r;
    }
    if (r.entry_price != null) {
      const fromPrice = scoreFromPrice(r.entry_price);
      return { ...r, value_score: fromPrice ?? (isYou ? 6 : 5.5) };
    }
    return {
      ...r,
      value_score: isYou ? 6 : 5.5,
      value_score_estimated: true,
    };
  };

  return {
    you: scoreRow(you, true),
    rivals: list.map((r) => scoreRow(r, false)),
  };
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
          err.code = 'TIMEOUT';
          reject(err);
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const SKIP_HOST_RE = /(?:google|bing|yahoo|wikipedia|reddit|youtube|facebook|twitter|x\.com|linkedin|g2\.com|capterra|alternativeto|producthunt|apple\.com|play\.google|apps\.apple|medium\.com|substack|forbes|techcrunch|nytimes|tomsguide|pcmag|wirecutter|cnbc|bloomberg|fly\.dev|github\.com|notion\.site)/i;
const LISTICLE_TITLE_RE = /\b(best|top)\s+\d*\s*|alternatives?\s+20\d{2}|tested and|reviewed|vs\.? |comparison|roundup/i;

function rivalsFromSearchSources(sources, host) {
  const seen = new Set([host]);
  const out = [];
  for (const s of sources || []) {
    const website = normalizeUrl(s?.url);
    if (!website) continue;
    const h = hostnameOf(website);
    if (!h || seen.has(h) || SKIP_HOST_RE.test(h)) continue;
    // Skip article/listicle pages — we want product homepages.
    try {
      const path = new URL(website).pathname || '/';
      if (path.length > 1 && /\/(blog|articles?|news|best-|top-|compare)/i.test(path)) continue;
      if ((path.match(/\//g) || []).length >= 3) continue;
    } catch {
      continue;
    }
    const title = String(s?.title || '');
    if (LISTICLE_TITLE_RE.test(title)) continue;
    seen.add(h);
    const brand = title.split(/[-–|:·]/)[0].trim();
    const name = (brand && brand.length <= 32 ? brand : h.split('.')[0]);
    out.push({
      name: name.slice(0, 48) || h,
      website: originOf(website) || website,
      pricing_url: originOf(website) || website,
    });
    if (out.length >= MAX_RIVALS) break;
  }
  return out;
}

function clampStatement(text, max = 180) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

function mergeRivals(primary, fallback, host) {
  const seen = new Set([host]);
  const out = [];
  for (const r of [...(primary || []), ...(fallback || [])]) {
    if (!r?.website) continue;
    const h = hostnameOf(r.website);
    if (!h || seen.has(h) || SKIP_HOST_RE.test(h)) continue;
    seen.add(h);
    const statement = clampStatement(r.statement || r.blurb, 120);
    out.push({
      name: String(r.name || h.split('.')[0]).slice(0, 48),
      website: originOf(r.website) || r.website,
      pricing_url: normalizeUrl(r.pricing_url) || originOf(r.website) || r.website,
      ...(statement ? { statement } : {}),
    });
    if (out.length >= MAX_RIVALS) break;
  }
  return out;
}

async function extractRivalsFromSearch({ host, userUrl, searchText }) {
  const result = await completeJSON({
    system: 'You extract competitor lists and short company blurbs from web search snippets. Return ONLY valid JSON.',
    user: `Product URL: ${userUrl}
Hostname: ${host}

From the search results below, identify the product/company ("you") and ${MAX_RIVALS} direct competitors.

Return:
{
  "market": "short market label",
  "you": {
    "name": "product or company name",
    "statement": "1–2 short sentences: what the company is / does (product positioning, not marketing fluff)"
  },
  "rivals": [
    {
      "name": "string",
      "website": "https://...",
      "pricing_url": "https://.../pricing or same as website",
      "statement": "one short line: what this rival is / does"
    }
  ]
}

Rules:
- Return ${MAX_RIVALS} rivals whenever the market is recognizable — prefer named direct product peers (apps/SaaS) over generic platforms or media sites.
- Each rival MUST include an official product website (homepage). If a competitor is named in snippets without a URL, use its well-known official domain when you are confident (e.g. Runna → https://www.runna.com).
- Prefer pricing_url ending in /pricing when known; otherwise use the homepage.
- rivals must be real competing products/companies (not the same host as ${host}).
- Never invent fake brands. Skip review sites, app stores, Wikipedia, G2, Reddit.
- you.statement: 1–2 concise sentences (≤ ~40 words) about what the submitted company builds or sells. Product positioning, not a press release.
- rivals[].statement: one short line each (≤ ~18 words). Omit only if snippets give no clue.
- Max ${MAX_RIVALS} rivals.

SEARCH RESULTS:
${String(searchText || '').slice(0, 7000)}`,
    maxTokens: 900,
  });

  const youName = (result?.you?.name || host).trim();
  const youStatement = clampStatement(result?.you?.statement || result?.you?.blurb, 180);
  const rivals = (Array.isArray(result?.rivals) ? result.rivals : [])
    .map((r) => {
      const website = normalizeUrl(r?.website) || normalizeUrl(r?.url);
      const pricing_url = normalizeUrl(r?.pricing_url) || website;
      const name = String(r?.name || '').trim() || (website ? hostnameOf(website) : '');
      if (!name || !website) return null;
      if (hostnameOf(website) === host || hostnameOf(pricing_url) === host) return null;
      if (SKIP_HOST_RE.test(hostnameOf(website))) return null;
      const statement = clampStatement(r?.statement || r?.blurb, 120);
      return { name, website, pricing_url, ...(statement ? { statement } : {}) };
    })
    .filter(Boolean)
    .slice(0, MAX_RIVALS);

  return {
    market: String(result?.market || `Competitors for ${host}`).trim(),
    youName,
    youStatement,
    rivals,
  };
}

async function extractPricesWithGrok(items) {
  // items: [{ key, name, url, markdown }]
  const thin = items.filter((it) => it.markdown && contentUseful(it.markdown));
  if (!thin.length) return {};

  const blocks = thin.map((it, i) => (
    `[${i}] ${it.name} — ${it.url}\n${String(it.markdown).slice(0, 2500)}`
  )).join('\n\n---\n\n');

  const result = await completeJSON({
    system: 'You extract software entry prices from pricing page text. Return ONLY valid JSON.',
    user: `For each numbered company, extract the lowest paid monthly entry price in USD.
Return:
{ "prices": [{ "index": 0, "entry_price": number|null }] }

Rules:
- entry_price is USD per month for the cheapest paid plan (yearly÷12, weekly×4.33).
- Use null if no clear public price.
- Only use prices present in the content.

CONTENT:
${blocks.slice(0, 12000)}`,
    maxTokens: 500,
  });

  const out = {};
  for (const row of Array.isArray(result?.prices) ? result.prices : []) {
    const idx = Number(row?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= thin.length) continue;
    const p = row?.entry_price;
    const n = typeof p === 'number' ? p : Number(p);
    if (Number.isFinite(n) && n > 0 && n <= 2000) {
      out[thin[idx].key] = Math.round(n * 100) / 100;
    }
  }
  return out;
}

/**
 * @param {string} productUrl
 * @param {{ onEvent?: (event: string, data: any) => void|Promise<void> }} [opts]
 */
export async function buildDemoCompetitorsFast(productUrl, { onEvent } = {}) {
  const emit = async (event, data) => {
    try {
      await onEvent?.(event, data);
    } catch {
      /* ignore client disconnect mid-emit */
    }
  };

  const url = normalizeUrl(productUrl);
  if (!url) {
    const err = new Error('Enter a valid product or pricing URL (https://…).');
    err.code = 'INVALID_URL';
    throw err;
  }

  const host = hostnameOf(url);
  const key = cacheKeyFor(url);
  const timings = { t0: Date.now(), searchMs: null, extractMs: null, contentsMs: null, priceMs: null, totalMs: null };

  if (key) {
    const hit = getCached(key);
    if (hit) {
      timings.totalMs = 0;
      await emit('status', { step: 'cache', label: 'Loading cached result…' });
      await emit('competitors', { market: hit.market, you: hit.you, rivals: hit.rivals.map(({ entry_price, value_score, ...rest }) => rest) });
      await emit('pricing', { you: hit.you, rivals: hit.rivals });
      await emit('done', { ...hit, timings: { ...hit.timings, totalMs: 0, cache: true }, cached: true });
      return { ...hit, timings: { ...hit.timings, totalMs: 0, cache: true }, cached: true };
    }
  }

  const deadline = Date.now() + WALL_MS;
  const remaining = () => Math.max(0, deadline - Date.now());
  let partial = false;

  let market = `Competitors for ${host}`;
  let youName = host;
  let rivals = [];
  let you = {
    name: host,
    url,
    website: originOf(url),
    pricing_url: url,
    entry_price: null,
    isYou: true,
  };

  // --- 1) webSearch only (no research fallback) ---
  await emit('status', { step: 'search', label: 'Finding competitors…' });
  const searchBudget = Math.min(SEARCH_TIMEOUT_MS, Math.max(2000, remaining() - 9000));
  let searchText = '';
  let searchSources = [];
  try {
    const tSearch = Date.now();
    const search = await withTimeout(
      webSearch(
        `${host} alternatives competitors similar apps products pricing comparison -site:g2.com -site:capterra.com -site:apple.com`,
        {
          count: 12,
          timeoutMs: searchBudget,
          skipQueue: true,
          noResearchFallback: true,
        }
      ),
      searchBudget + 500,
      'webSearch'
    );
    timings.searchMs = Date.now() - tSearch;
    searchText = flattenYouPayload(search) || search?.text || '';
    searchSources = Array.isArray(search?.sources) ? search.sources : [];
  } catch {
    timings.searchMs = null;
    partial = true;
    searchText = '';
    searchSources = [];
  }

  if (remaining() < 2500) {
    partial = true;
    rivals = rivalsFromSearchSources(searchSources, host);
    const scored = withHeuristicValueScores(you, rivals);
    const payload = {
      market,
      you: scored.you,
      rivals: scored.rivals,
      timings: { ...timings, totalMs: Date.now() - timings.t0 },
      partial: true,
    };
    await emit('competitors', { market, you: { name: you.name, url: you.url, website: you.website }, rivals });
    await emit('done', payload);
    return payload;
  }

  // --- 2) Grok: market + rivals (source-host fallback if Grok is slow) ---
  await emit('status', { step: 'extract', label: 'Naming rivals…' });
  try {
    const tExtract = Date.now();
    // Leave ~7s after extract for one batched contents call (+ optional price Grok).
    const extractBudget = Math.min(9000, Math.max(4000, remaining() - 7000));
    const extracted = await withTimeout(
      extractRivalsFromSearch({ host, userUrl: url, searchText }),
      extractBudget,
      'extractRivals'
    );
    timings.extractMs = Date.now() - tExtract;
    market = extracted.market || market;
    youName = extracted.youName || youName;
    // Fill to MAX_RIVALS with source-host fallback when Grok returns a thin list.
    rivals = mergeRivals(extracted.rivals || [], rivalsFromSearchSources(searchSources, host), host);
    you = {
      ...you,
      name: youName,
      ...(extracted.youStatement ? { statement: extracted.youStatement } : {}),
    };
  } catch {
    timings.extractMs = null;
    partial = true;
    rivals = rivalsFromSearchSources(searchSources, host);
  }

  if (!rivals.length) {
    rivals = rivalsFromSearchSources(searchSources, host);
    if (rivals.length) partial = true;
  } else if (rivals.length < Math.min(3, MAX_RIVALS)) {
    rivals = mergeRivals(rivals, rivalsFromSearchSources(searchSources, host), host);
  }

  await emit('competitors', {
    market,
    you: {
      name: you.name,
      url: you.url,
      website: you.website,
      ...(you.statement ? { statement: you.statement } : {}),
    },
    rivals: rivals.map((r) => ({
      name: r.name,
      website: r.website,
      pricing_url: r.pricing_url,
      ...(r.statement ? { statement: r.statement } : {}),
    })),
  });

  if (remaining() < 2000) {
    partial = true;
    const scored = withHeuristicValueScores(you, rivals.map((r) => ({ ...r, entry_price: null })));
    const payload = {
      market,
      you: scored.you,
      rivals: scored.rivals,
      timings: { ...timings, totalMs: Date.now() - timings.t0 },
      partial: true,
    };
    await emit('done', payload);
    return payload;
  }

  // --- 3) Batched fetchContents ---
  await emit('status', { step: 'pricing', label: 'Reading pricing…' });
  const pricingTargets = [
    { key: 'you', name: you.name, url },
    ...rivals.map((r, i) => ({
      key: `rival:${i}`,
      name: r.name,
      url: normalizeUrl(r.pricing_url) || normalizeUrl(r.website),
    })),
  ].filter((t) => t.url).slice(0, MAX_CONTENT_URLS);

  let contentMap = {};
  try {
    const tContents = Date.now();
    const contentsBudget = Math.min(CONTENTS_TIMEOUT_MS, Math.max(5000, remaining() - 2000));
    // Single batched contents call (spec). No outer race — fetchContents returns partials on timeout.
    contentMap = await fetchContents(
      pricingTargets.map((t) => t.url),
      { skipQueue: true, timeoutMs: contentsBudget }
    );
    timings.contentsMs = Date.now() - tContents;
  } catch {
    timings.contentsMs = null;
    partial = true;
    contentMap = {};
  }

  // Recover markdown if the API keys results by a slightly different URL string.
  const markdownFor = (targetUrl) => {
    if (!targetUrl) return '';
    if (contentMap[targetUrl]?.markdown) return contentMap[targetUrl].markdown;
    const h = hostnameOf(targetUrl);
    for (const [k, v] of Object.entries(contentMap)) {
      if (v?.markdown && hostnameOf(k) === h) return v.markdown;
    }
    return '';
  };

  // --- 4) Regex scrape; Grok batch only if thin ---
  const scraped = {};
  const needsGrok = [];
  for (const t of pricingTargets) {
    const md = markdownFor(t.url);
    const price = scrapeEntryPrice(md);
    if (price != null) {
      scraped[t.key] = price;
    } else if (md && (contentUseful(md) || md.length > 400)) {
      needsGrok.push({ ...t, markdown: md });
    }
  }

  let grokPrices = {};
  // Prefer a short Grok price pass whenever scrape is thin and we still have budget.
  if (needsGrok.length && remaining() > 1800) {
    try {
      const tPrice = Date.now();
      const priceBudget = Math.min(5500, Math.max(1800, remaining() - 200));
      grokPrices = await withTimeout(
        extractPricesWithGrok(needsGrok),
        priceBudget,
        'extractPrices'
      );
      timings.priceMs = Date.now() - tPrice;
    } catch {
      timings.priceMs = null;
      partial = true;
    }
  } else if (needsGrok.length || Object.keys(scraped).length === 0) {
    partial = true;
  }

  you = {
    ...you,
    entry_price: scraped.you ?? grokPrices.you ?? null,
  };
  await emit('rival', { role: 'you', ...you });

  rivals = rivals.map((r, i) => {
    const keyR = `rival:${i}`;
    const entry_price = scraped[keyR] ?? grokPrices[keyR] ?? null;
    const row = { ...r, entry_price };
    return row;
  });

  for (const r of rivals) {
    await emit('rival', { role: 'rival', ...r });
  }

  const scored = withHeuristicValueScores(you, rivals);
  const pricedCount = [scored.you, ...scored.rivals].filter((c) => c?.entry_price != null).length;
  if (pricedCount < 2) partial = true;

  timings.totalMs = Date.now() - timings.t0;
  const payload = {
    market,
    you: scored.you,
    rivals: scored.rivals,
    timings,
    ...(partial ? { partial: true } : {}),
  };

  await emit('status', { step: 'plot', label: 'Plotting map…' });
  await emit('pricing', { you: scored.you, rivals: scored.rivals });
  await emit('done', payload);

  // Only cache useful results (at least one price). Empty-price partials must re-run.
  if (key && pricedCount >= 1) {
    setCached(key, payload);
  }

  return payload;
}

// tiny helper export for tests
export const __demoFastInternals = { scrapeEntryPrice, cache, normalizeUrl, hostnameOf };
