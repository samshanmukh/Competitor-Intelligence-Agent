/**
 * Landing-page fast competitors + pricing path.
 * Target wall clock <20s.
 *
 * Pipeline:
 *   1. Normalize URL (https:// if missing)
 *   2. webSearch #1 — company about URL/host
 *   3. Grok (or light parse) → name, statement, market — emit early
 *   4. webSearch #2 — "closest competitors to {name} {host} …"
 *   5. Optional you-research lite if search is thin / wrong category
 *   6. Grok → up to 4 rivals (+ snippet prices)
 *   7. Optional snippet price pass (no Contents)
 *   8. Plot all rivals even without price (n/a lane)
 */

import { webSearch, research, flattenYouPayload, markdownFromSearchSources, searchAboutUrl } from './youcom.js';
import { completeJSON } from './ai.js';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const WALL_MS = 19000;
const SEARCH_TIMEOUT_MS = 6500;
const RESEARCH_LITE_TIMEOUT_MS = 8000;
const MAX_RIVALS = 4;
const CACHE_PREFIX = 'demo:fast:v6:';

/** Well-known product domains so named peers plot even when search only cites listicles. */
const KNOWN_PRODUCT_DOMAINS = {
  'lovable': 'https://lovable.dev',
  'lovable.dev': 'https://lovable.dev',
  'bolt': 'https://bolt.new',
  'bolt.new': 'https://bolt.new',
  'replit': 'https://replit.com',
  'replit agent': 'https://replit.com',
  'base44': 'https://base44.com',
  'emergent': 'https://emergent.sh',
  'manus': 'https://manus.im',
  'v0': 'https://v0.dev',
  'v0.dev': 'https://v0.dev',
  'firebase studio': 'https://studio.firebase.google.com',
  'cursor': 'https://cursor.com',
  'windsurf': 'https://windsurf.com',
  'runna': 'https://www.runna.com',
  'strava': 'https://www.strava.com',
};

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
 * Prefer the lowest plausible paid monthly entry price from markdown/snippets.
 * Converts weekly×4.33, quarterly÷3, yearly÷12. Keeps "$X/mo billed annually" as X
 * (do not divide again). Returns 0 only when Free/$0 is present and no paid tier.
 */
export function scrapeEntryPrice(markdown) {
  const text = String(markdown || '');
  if (!text.trim()) return null;

  const paid = [];
  let hasFree = /\bfree\b(?:\s+(?:plan|tier|forever|version))?|\b\$\s*0(?:\.0+)?\b/i.test(text);

  const re = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const amount = Number(String(m[1]).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0 || amount > 50000) continue;
    if (amount === 0) {
      hasFree = true;
      continue;
    }

    // Tight suffix so the next plan's label ("… $39.99 quarterly $89…") does not
    // attach to this amount. For ranges ("$14.99–$17.99/week"), inherit the
    // period from after the range end.
    const rawSuffix = text.slice(m.index + m[0].length, m.index + m[0].length + 36).toLowerCase();
    const rangeSkip = rawSuffix.match(/^\s*[-–—]\s*\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/);
    const suffix = rangeSkip ? rawSuffix.slice(rangeSkip[0].length) : rawSuffix;
    const billedTail = text.slice(m.index + m[0].length, m.index + m[0].length + 48).toLowerCase();
    const before = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
    const ctx = `${before} ${suffix}`;

    if (/\/\s*user|per\s+seat|seat|employee|mau|credit/i.test(ctx) && !/\/\s*mo|month|\/mo\b/i.test(ctx)) {
      if (!/month|\/\s*mo|\/mo\b|billed/i.test(ctx)) continue;
    }

    // Period labels must sit on this price (suffix, or immediately before).
    const labeledMonthly = /^\s*(\/\s*mo\b|\/mo\b|per\s+month|\/month|\ba month\b)/i.test(suffix)
      || /\b(monthly|per\s+month)\s*[-–:]?\s*$/i.test(before);
    const labeledWeekly = /^\s*(\/\s*wk|\/\s*week|per\s+week|\ba week\b)/i.test(suffix)
      || /\b(weekly|per\s+week)\s*[-–:]?\s*$/i.test(before);
    const labeledQuarterly = /^\s*(\/\s*3\s*mo|per\s+quarter|\/quarter|every\s+3\s+months|\/\s*3\s*months)/i.test(suffix)
      || /\b(quarterly|per\s+quarter)\s*[-–:]?\s*$/i.test(before);
    // Yearly *amount* only — not "billed annually" on an already-monthly figure.
    const labeledYearlyAmount = (
      /^\s*(\/\s*yr\b|\/\s*year|per\s+year|\/year\b|\/yr\b|\ba year\b)/i.test(suffix)
      || (
        /\b(yearly|annual)\s*(?:price|fee|cost|plan|subscription)?\s*[-–:]?\s*$/i.test(before)
        && !labeledMonthly
        && !/\bbilled\s+annual/i.test(billedTail)
      )
    );

    let monthly = amount;
    if (labeledWeekly) {
      monthly = Math.round((amount * 4.33) * 100) / 100;
    } else if (labeledQuarterly) {
      monthly = Math.round((amount / 3) * 100) / 100;
    } else if (labeledYearlyAmount) {
      monthly = Math.round((amount / 12) * 100) / 100;
    } else {
      // Monthly label, "billed annually", or bare SaaS-looking amount.
      monthly = amount;
    }

    if (monthly > 0 && monthly <= 2000) paid.push(monthly);
  }

  if (paid.length) return Math.min(...paid);
  if (hasFree) return 0;
  return null;
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

const SKIP_HOST_RE = /(?:^(?:www\.)?(?:google|bing|yahoo|wikipedia|reddit|youtube|facebook|twitter|x\.com|linkedin|g2\.com|capterra|alternativeto|producthunt|apple\.com|play\.google|apps\.apple|medium\.com|substack|forbes|techcrunch|nytimes|tomsguide|pcmag|wirecutter|cnbc|bloomberg|fly\.dev|github\.com|notion\.site)(?:\.|$))/i;

function isSkippedHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return true;
  if (/firebase/.test(h)) return false; // Firebase Studio is a valid peer
  return SKIP_HOST_RE.test(h) || /(?:^|\.)google\.com$/.test(h);
}
const LISTICLE_TITLE_RE = /\b(best|top)\s+\d*\s*|alternatives?\s+20\d{2}|tested and|reviewed|vs\.? |comparison|roundup/i;
const USELESS_MARKET_RE = /^(unknown|n\/?a|none|null|undefined|competitors?|market|general|other)$/i;
const USELESS_STATEMENT_RE = /no information available|no (?:usable |relevant )?information|could not (?:find|determine)|insufficient (?:data|information)|from search results\.?$/i;

function clampStatement(text, max = 180) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (USELESS_STATEMENT_RE.test(s)) return null;
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

function brandFromHost(host) {
  const base = String(host || '').split('.')[0] || 'Product';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Last-resort market label when snippets exist but Grok returned junk/"unknown". */
function fallbackMarketLabel(host, searchText = '') {
  const text = String(searchText || '');
  const categoryHit = text.match(
    /\b((?:AI |ai )?(?:running|fitness|coaching|CRM|SaaS|analytics|marketing|design|devtools?|developer|productivity|fintech|health|education|e-?commerce|marketplace|security|HR|recruiting|scheduling|billing|invoicing|project management|collaboration)(?:\s+(?:app|software|platform|tool|coach|tracker))?)\b/i
  );
  if (categoryHit?.[1]) {
    const cat = categoryHit[1].replace(/\s+/g, ' ').trim();
    return `${cat.charAt(0).toUpperCase()}${cat.slice(1)} tools`;
  }
  const brand = brandFromHost(host);
  return `${brand} market`;
}

function sanitizeMarket(raw, host, searchText = '') {
  const m = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!m || USELESS_MARKET_RE.test(m) || m.length < 3) {
    return fallbackMarketLabel(host, searchText);
  }
  // Grok sometimes echoes "unknown market" / "Unknown category"
  if (/\bunknown\b/i.test(m) && m.length < 40) {
    return fallbackMarketLabel(host, searchText);
  }
  // Too-generic labels when snippets clearly describe a product agent / app builder.
  if (/^(marketing|business|software|tech|ai|general) tools$/i.test(m)
    && isAiAppBuilderClass(m, searchText)) {
    return 'AI app builders';
  }
  return m.slice(0, 80);
}

function statementFromSearchText(searchText, host) {
  const lines = String(searchText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^https?:\/\//i.test(l));
  // Prefer a line that mentions the host or looks like a product blurb.
  const hostHit = lines.find((l) => host && l.toLowerCase().includes(host.split('.')[0]));
  const longish = lines.find((l) => l.length > 50 && !LISTICLE_TITLE_RE.test(l));
  const title = lines[0] || '';
  const pick = hostHit || longish || (title.length > 20 ? title : lines.slice(0, 2).join(' — '));
  return clampStatement(pick, 180);
}

function nameFromSearchText(searchText, host) {
  const lines = String(searchText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^https?:\/\//i.test(l));
  // Prefer "Remy — An AI agent…" style titles over hostname brands.
  for (const title of lines.slice(0, 5)) {
    const em = title.match(/^([A-Z][\w.+-]{1,40})\s*[—–:|·-]/);
    if (em?.[1] && !LISTICLE_TITLE_RE.test(em[1]) && !/^https?/i.test(em[1])) {
      return em[1];
    }
    const brand = title.split(/[-–|:·]/)[0].trim();
    if (brand && brand.length <= 32 && brand.length >= 2 && !LISTICLE_TITLE_RE.test(brand) && !/\s/.test(brand)) {
      return brand;
    }
  }
  return brandFromHost(host);
}

function looksLikeCategoryNotProduct(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (knownWebsiteForName(n)) return false;
  // "Vibe Coding Apps", "AI Tools", "Marketing tools"
  if (/^(best|top)\b/i.test(n)) return true;
  if (/\b(apps|tools|platforms|software|alternatives|competitors)\b/i.test(n) && n.split(/\s+/).length >= 2) {
    return true;
  }
  return false;
}

function rivalsFromSearchSources(sources, host) {
  const seen = new Set([host]);
  const out = [];
  for (const s of sources || []) {
    const website = normalizeUrl(s?.url);
    if (!website) continue;
    const h = hostnameOf(website);
    if (!h || seen.has(h) || isSkippedHost(h)) continue;
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
    const snippetPrice = scrapeEntryPrice(s?.snippet || '');
    out.push({
      name: name.slice(0, 48) || h,
      website: originOf(website) || website,
      pricing_url: originOf(website) || website,
      ...(snippetPrice != null ? { entry_price: snippetPrice } : {}),
    });
    if (out.length >= MAX_RIVALS) break;
  }
  return out;
}

function knownWebsiteForName(name) {
  const key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  if (KNOWN_PRODUCT_DOMAINS[key]) return KNOWN_PRODUCT_DOMAINS[key];
  // Try without trailing "AI" / "Agent"
  const stripped = key.replace(/\s+(ai|agent|studio)$/i, '').trim();
  if (stripped && KNOWN_PRODUCT_DOMAINS[stripped]) return KNOWN_PRODUCT_DOMAINS[stripped];
  return null;
}

function resolveRivalWebsite(r) {
  const fromField = normalizeUrl(r?.website) || normalizeUrl(r?.url) || normalizeUrl(r?.pricing_url);
  if (fromField && !isSkippedHost(hostnameOf(fromField))) return fromField;
  return knownWebsiteForName(r?.name);
}

function mergeRivals(primary, fallback, host) {
  const seen = new Set([host]);
  const out = [];
  for (const r of [...(primary || []), ...(fallback || [])]) {
    const name = String(r.name || '').trim();
    if (name && looksLikeCategoryNotProduct(name)) continue;
    const website = resolveRivalWebsite(r);
    if (!website) continue;
    const h = hostnameOf(website);
    if (!h || seen.has(h) || isSkippedHost(h)) continue;
    seen.add(h);
    const statement = clampStatement(r.statement || r.blurb || r.best_known_for || r.how_it_differs, 120);
    const entry = r.entry_price != null && Number.isFinite(Number(r.entry_price))
      ? Number(r.entry_price)
      : null;
    out.push({
      name: (name || h.split('.')[0]).slice(0, 48),
      website: originOf(website) || website,
      pricing_url: normalizeUrl(r.pricing_url) || originOf(website) || website,
      ...(statement ? { statement } : {}),
      ...(entry != null && entry >= 0 && entry <= 2000 ? { entry_price: Math.round(entry * 100) / 100 } : {}),
    });
    if (out.length >= MAX_RIVALS) break;
  }
  return out;
}

function isAiAppBuilderClass(market, statement) {
  const blob = `${market || ''} ${statement || ''}`;
  return /product agent|app builder|vibe.?cod|full-?stack|prompt.?to.?app|ai (?:app|product) (?:builder|agent)|builds?,?\s*ships?|ships? (?:whole )?apps|compiles? (?:annotated )?markdown|goremy/i.test(blob);
}

function isRunningCoachClass(market, statement) {
  const blob = `${market || ''} ${statement || ''}`;
  // Avoid matching verbs like "runs products" — require running/fitness sense.
  return /\brunning\b|\brun coach\b|\bfitness\b|\btraining plan\b|\bmarathon\b|\bstrava\b|\brunna\b/i.test(blob);
}

/** Queries that surface same-class peers (e.g. Remy → Lovable/Bolt/Replit), not name-collisions. */
function buildCompetitorQueries({ companyName, host, market, statement }) {
  const name = String(companyName || '').trim() || brandFromHost(host);
  const marketHint = market && !USELESS_MARKET_RE.test(market) ? market : '';
  const appBuilder = isAiAppBuilderClass(marketHint, statement);
  const running = !appBuilder && isRunningCoachClass(marketHint, statement);

  if (appBuilder) {
    return [
      `closest competitors to ${name} ${host} AI app builder vibe coding`,
      `${name} ${host} vs Lovable Bolt.new Replit Agent v0 Base44 Emergent alternatives`,
    ];
  }
  if (running) {
    return [
      `closest competitors to ${name} ${host} running coach app`,
      `${name} ${host} vs alternatives competitors similar running training apps`,
    ];
  }
  const cat = marketHint || 'AI agent product';
  return [
    `closest competitors to ${name} ${host} ${cat}`,
    `${name} ${host} vs alternatives competitors similar products ${cat}`,
  ];
}

/**
 * True when evidence names same-class product peers.
 * Generic "X alternatives" listicles (name collisions like Remi AI logistics) do NOT count.
 */
function rivalEvidenceLooksUseful(text, { host, companyName } = {}) {
  const t = String(text || '');
  if (!t.trim()) return false;
  // Named peers win even on short snippets (listicle titles often name 3–4 tools).
  const named = (t.match(/\b(Lovable|Bolt\.new|Bolt|Replit|v0|Base44|Emergent|Manus|Cursor|Windsurf|Firebase Studio|Strava|Runna|Nike Run|Garmin|TrainingPeaks)\b/gi) || []).length;
  if (named >= 2) return true;
  // Require the real product host/name plus multiple distinct https product links.
  const hostHit = host && t.toLowerCase().includes(String(host).toLowerCase());
  const nameHit = companyName && new RegExp(`\\b${String(companyName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t);
  if (!(hostHit || nameHit)) return false;
  const urls = (t.match(/https?:\/\/[^\s)]+/gi) || [])
    .map((u) => hostnameOf(u))
    .filter((h) => h && h !== host && !SKIP_HOST_RE.test(h));
  return new Set(urls).size >= 3;
}

async function researchLiteCompetitors({ companyName, host, market, statement, userUrl, timeoutMs }) {
  const name = companyName || brandFromHost(host);
  const appBuilder = isAiAppBuilderClass(market, statement);
  const input = [
    `Closest competitors / alternatives to ${name} (${userUrl || host}).`,
    market ? `Market/category: ${market}.` : '',
    statement ? `Product positioning: ${String(statement).slice(0, 220)}` : '',
    'List the 4–8 closest direct product peers (same class of product).',
    'For each: name, official website if known, what it is best known for, and how it differs from this product.',
    appBuilder
      ? 'This is an AI product/app builder (vibe-coding / product-agent class). Prioritize peers such as Replit Agent, Lovable, Bolt.new, Base44, Emergent, Manus, Firebase Studio, and v0 — not unrelated companies that only share a similar name.'
      : 'Prefer real shipping products over review sites. Do not confuse similarly named companies in unrelated industries.',
  ].filter(Boolean).join(' ');

  const payload = await withTimeout(
    research(input, { effort: 'lite' }),
    timeoutMs,
    'researchLite'
  );
  const text = flattenYouPayload(payload) || payload?.output?.content || '';
  const sources = (payload?.output?.sources || []).map((s) => ({
    title: s.title || '',
    url: s.url || '',
    snippet: Array.isArray(s.snippets) ? s.snippets.join(' ') : (s.snippet || ''),
  }));
  return { text, sources, engine: 'youcom-research-lite' };
}

function blurbNearName(text, name) {
  const t = String(text || '');
  if (!t || !name) return null;
  const re = new RegExp(`.{0,60}\\b${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b.{0,100}`, 'i');
  const m = t.match(re);
  if (!m) return null;
  return clampStatement(m[0].replace(/\s+/g, ' ').trim(), 120);
}

/** Last-resort: pull well-known peer names mentioned in evidence when Grok returns nothing. */
function rivalsFromNamedMentions(text, host) {
  const t = String(text || '');
  if (!t) return [];
  const patterns = [
    { re: /\bLovable\b/i, name: 'Lovable' },
    { re: /\bBolt\.new\b/i, name: 'Bolt.new' },
    { re: /\bReplit(?:\s+Agent)?\b/i, name: 'Replit Agent' },
    { re: /\bBase44\b/i, name: 'Base44' },
    { re: /\bEmergent\b/i, name: 'Emergent' },
    { re: /\bManus\b/i, name: 'Manus' },
    { re: /\bFirebase Studio\b/i, name: 'Firebase Studio' },
    { re: /\bv0\b/i, name: 'v0' },
    { re: /\bRunna\b/i, name: 'Runna' },
    { re: /\bStrava\b/i, name: 'Strava' },
  ];
  const out = [];
  const seen = new Set([host]);
  for (const p of patterns) {
    if (!p.re.test(t)) continue;
    const website = knownWebsiteForName(p.name);
    if (!website) continue;
    const h = hostnameOf(website);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    const statement = blurbNearName(t, p.name);
    out.push({
      name: p.name,
      website,
      pricing_url: website,
      ...(statement ? { statement } : {}),
    });
    if (out.length >= MAX_RIVALS) break;
  }
  return out;
}

async function extractCompanyIdentity({ host, userUrl, searchText, hasHits }) {
  if (!String(searchText || '').trim()) {
    return {
      market: fallbackMarketLabel(host, ''),
      youName: brandFromHost(host),
      youStatement: null,
    };
  }

  let result = null;
  try {
    result = await completeJSON({
      system: 'You extract company identity from web search snippets. Return ONLY valid JSON.',
      user: `Product URL: ${userUrl}
Hostname: ${host}

From the search results below, identify what this company/product is.

Return:
{
  "name": "product or company name",
  "statement": "1–2 short sentences: what the company is / does (product positioning)",
  "market": "short market/category label (e.g. AI running coaches, B2B CRM)"
}

Rules:
- Use ONLY facts present in the search results.
- market MUST be a real category/label — never "unknown", "n/a", or empty when snippets describe the product.
- statement: product positioning (≤ ~40 words). Never say "No information available…".
- If the brand name is unclear, use a short label from the page title or hostname.

SEARCH RESULTS:
${String(searchText || '').slice(0, 6000)}`,
      maxTokens: 400,
    });
  } catch {
    result = null;
  }

  const youName = String(result?.name || '').trim() || nameFromSearchText(searchText, host);
  let youStatement = clampStatement(result?.statement || result?.description || result?.blurb, 180);
  if (!youStatement && hasHits) {
    youStatement = statementFromSearchText(searchText, host);
  }
  const market = sanitizeMarket(result?.market, host, searchText);

  return { market, youName, youStatement };
}

async function extractRivalsFromSearch({ host, userUrl, companyName, market, searchText }) {
  const result = await completeJSON({
    system: 'You extract closest product competitors from web research/search. Return ONLY valid JSON.',
    user: `Product: ${companyName || host}
URL: ${userUrl}
Market: ${market || 'same product category'}
Hostname to exclude: ${host}

From the evidence below, identify up to ${MAX_RIVALS} CLOSEST direct competitors — same class of product (e.g. for an AI product/app builder: Lovable, Bolt.new, Replit Agent, v0, Base44, Emergent, Manus, Firebase Studio — NOT unrelated companies that merely share a similar name).

Return:
{
  "rivals": [
    {
      "name": "string",
      "website": "https://official-homepage",
      "pricing_url": "https://.../pricing or homepage",
      "statement": "best known for + how it differs (≤ ~22 words)",
      "entry_price": number|null
    }
  ]
}

Rules:
- Prefer peers named in comparison/alternative articles even when only the article URL is present.
- Each rival needs an official product website. Use well-known domains when confident (lovable.dev, bolt.new, replit.com, v0.dev, base44.com, emergent.sh, manus.im, etc.).
- Reject wrong-industry name collisions (e.g. logistics "Remi AI" when the product is Remy the AI product agent at goremy.ai).
- Skip review aggregators (G2, Capterra), app stores, Wikipedia, Reddit, news roundups as rivals themselves.
- entry_price: USD/mo cheapest paid plan when present in evidence; else null.
- Do not include ${host} or ${companyName || host}.

EVIDENCE:
${String(searchText || '').slice(0, 9000)}`,
    maxTokens: 1000,
  });

  const rivals = (Array.isArray(result?.rivals) ? result.rivals : [])
    .map((r) => {
      const website = resolveRivalWebsite(r);
      const pricing_url = normalizeUrl(r?.pricing_url) || website;
      const name = String(r?.name || '').trim() || (website ? hostnameOf(website) : '');
      if (!name || !website) return null;
      if (hostnameOf(website) === host || hostnameOf(pricing_url) === host) return null;
      if (isSkippedHost(hostnameOf(website))) return null;
      const statement = clampStatement(
        r?.statement || r?.blurb || [r?.best_known_for, r?.how_it_differs].filter(Boolean).join(' — '),
        140
      );
      const p = r?.entry_price;
      const n = typeof p === 'number' ? p : Number(p);
      const entry_price = Number.isFinite(n) && n >= 0 && n <= 2000 ? Math.round(n * 100) / 100 : null;
      const scraped = entry_price ?? scrapeEntryPrice([r?.statement, r?.notes, r?.pricing].filter(Boolean).join(' '));
      return {
        name,
        website,
        pricing_url,
        ...(statement ? { statement } : {}),
        ...(scraped != null ? { entry_price: scraped } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_RIVALS);

  return { rivals };
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function priceChunksNearTarget(text, { name, host }) {
  const chunks = [];
  if (name) {
    const re = new RegExp(`.{0,100}\\b${escapeRegExp(name)}\\b.{0,180}`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null && chunks.length < 4) chunks.push(m[0]);
  }
  if (host) {
    const reH = new RegExp(`.{0,80}${escapeRegExp(host)}.{0,140}`, 'gi');
    let mh;
    while ((mh = reH.exec(text)) !== null && chunks.length < 6) chunks.push(mh[0]);
  }
  return chunks;
}

async function runPriceSearch(query, remainingMs) {
  const budget = Math.min(SEARCH_TIMEOUT_MS, Math.max(2000, remainingMs() - 600));
  const hit = await withTimeout(
    webSearch(query, {
      count: 10,
      timeoutMs: budget,
      skipQueue: true,
      noResearchFallback: true,
    }),
    budget + 400,
    'priceSearch'
  );
  let text = flattenYouPayload(hit) || hit?.text || '';
  for (const s of hit?.sources || []) {
    text += `\n${s.title || ''} ${s.snippet || ''}`;
  }
  return text;
}

/**
 * Snippet-only price pass (no Contents — SPAs often have no public /pricing page).
 * Uses the You.com-winning query shape: `what is {url} prices`, plus a small
 * rival batch when wall-clock allows.
 */
async function enrichPricesFromSearch({ you, rivals, remainingMs }) {
  const youUnpriced = you?.entry_price == null;
  const rivalTargets = rivals
    .map((r, i) => ({
      key: `rival:${i}`,
      name: r.name,
      host: hostnameOf(r.website),
      current: r.entry_price,
    }))
    .filter((t) => t.current == null && t.name);

  if ((!youUnpriced && !rivalTargets.length) || remainingMs() < 2500) {
    return { youPrice: you.entry_price, rivalPrices: {} };
  }

  let youPrice = you.entry_price;
  const rivalPrices = {};

  const jobs = [];

  // Primary product: dedicated URL pricing query (matches ChatGPT/You.com).
  if (youUnpriced) {
    const youUrl = normalizeUrl(you.url) || normalizeUrl(you.website) || normalizeUrl(you.pricing_url);
    const youQuery = youUrl
      ? `what is ${youUrl} prices`
      : `${you.name} pricing plans`;
    jobs.push(
      runPriceSearch(youQuery, remainingMs)
        .then((text) => {
          // Query is scoped to this product — scrape the full hit set first.
          let price = scrapeEntryPrice(text);
          if (price == null) {
            price = scrapeEntryPrice(
              priceChunksNearTarget(text, {
                name: you.name,
                host: hostnameOf(youUrl || you.website),
              }).join(' ')
            );
          }
          if (price != null) youPrice = price;
        })
        .catch(() => {})
    );
  }

  // Rivals: one combined query when there is still budget after/parallel with you.
  if (rivalTargets.length && remainingMs() > 3200) {
    const slice = rivalTargets.slice(0, 3);
    const names = slice.map((t) => t.name).join(' OR ');
    const rivalQuery = `(${names}) pricing plans cost subscription`;
    jobs.push(
      runPriceSearch(rivalQuery, remainingMs)
        .then((text) => {
          for (const t of slice) {
            const price = scrapeEntryPrice(priceChunksNearTarget(text, t).join(' '));
            if (price != null) rivalPrices[t.key] = price;
          }
        })
        .catch(() => {})
    );
  }

  if (!jobs.length) return { youPrice, rivalPrices };

  try {
    await withTimeout(Promise.all(jobs), Math.min(9000, Math.max(2500, remainingMs() - 200)), 'priceSearchAll');
  } catch {
    /* partial results kept */
  }

  return { youPrice, rivalPrices };
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
  const timings = {
    t0: Date.now(),
    aboutMs: null,
    identityMs: null,
    searchMs: null,
    researchMs: null,
    extractMs: null,
    priceMs: null,
    totalMs: null,
  };

  if (key) {
    const hit = getCached(key);
    if (hit) {
      timings.totalMs = 0;
      await emit('status', { step: 'cache', label: 'Loading cached result…' });
      await emit('competitors', {
        market: hit.market,
        you: hit.you,
        rivals: hit.rivals.map(
          ({ entry_price: _p, value_score: _s, value_score_estimated: _e, ...rest }) => rest
        ),
      });
      await emit('pricing', { you: hit.you, rivals: hit.rivals });
      await emit('done', { ...hit, timings: { ...hit.timings, totalMs: 0, cache: true }, cached: true });
      return { ...hit, timings: { ...hit.timings, totalMs: 0, cache: true }, cached: true };
    }
  }

  const deadline = Date.now() + WALL_MS;
  const remaining = () => Math.max(0, deadline - Date.now());
  let partial = false;

  let market = fallbackMarketLabel(host, '');
  let youName = brandFromHost(host);
  let youStatement = null;
  let rivals = [];
  let you = {
    name: youName,
    url,
    website: originOf(url),
    pricing_url: url,
    entry_price: null,
    isYou: true,
  };

  // --- 1) webSearch #1: company about URL (playground-style) ---
  await emit('status', { step: 'search', label: 'Looking up company…' });
  let aboutText = '';
  let aboutSources = [];
  let aboutHasHits = false;
  try {
    const tAbout = Date.now();
    const aboutBudget = Math.min(SEARCH_TIMEOUT_MS, Math.max(2500, remaining() - 11000));
    const about = await withTimeout(
      searchAboutUrl(url, {
        timeoutMs: aboutBudget,
        skipQueue: true,
        count: 8,
      }),
      aboutBudget + 500,
      'searchAbout'
    );
    timings.aboutMs = Date.now() - tAbout;
    aboutSources = Array.isArray(about?.sources) ? about.sources : [];
    aboutHasHits = aboutSources.length > 0 || Boolean(about?.markdown);
    aboutText = about?.markdown
      || markdownFromSearchSources(url, aboutSources)
      || '';
    // If searchAboutUrl marked thin but we still have sources, keep the joined text.
    if (!aboutText && aboutSources.length) {
      aboutText = aboutSources
        .map((s) => [s.title, s.snippet, s.url].filter(Boolean).join(' — '))
        .join('\n');
    }
  } catch {
    timings.aboutMs = null;
    partial = true;
  }

  // --- 2) Identity extract + early SSE ---
  await emit('status', { step: 'identity', label: 'Looking up company…' });
  try {
    const tId = Date.now();
    // Identity needs ~4–5s for Grok; leave ≥12s for competitor search/extract.
    const idBudget = Math.min(5000, Math.max(2500, remaining() - 12000));
    const identity = await withTimeout(
      extractCompanyIdentity({
        host,
        userUrl: url,
        searchText: aboutText,
        hasHits: aboutHasHits,
      }),
      idBudget,
      'extractIdentity'
    );
    timings.identityMs = Date.now() - tId;
    market = identity.market;
    youName = identity.youName || youName;
    youStatement = identity.youStatement;
  } catch {
    timings.identityMs = null;
    partial = true;
    market = sanitizeMarket(null, host, aboutText);
    youName = nameFromSearchText(aboutText, host);
    if (aboutHasHits) youStatement = statementFromSearchText(aboutText, host);
  }

  // Never surface useless market when we had search hits.
  market = sanitizeMarket(market, host, aboutText);
  you = {
    ...you,
    name: youName,
    ...(youStatement ? { statement: youStatement } : {}),
  };

  await emit('competitors', {
    market,
    you: {
      name: you.name,
      url: you.url,
      website: you.website,
      ...(you.statement ? { statement: you.statement } : {}),
    },
    rivals: [],
  });

  if (remaining() < 2500) {
    partial = true;
    const scored = withHeuristicValueScores(you, []);
    const payload = {
      market,
      you: scored.you,
      rivals: [],
      timings: { ...timings, totalMs: Date.now() - timings.t0 },
      partial: true,
    };
    await emit('done', payload);
    return payload;
  }

  // --- 3) webSearch #2: closest competitors (playground-style query) ---
  await emit('status', { step: 'extract', label: 'Naming rivals…' });
  let rivalText = '';
  let rivalSources = [];
  let usedResearchLite = false;
  try {
    const tSearch = Date.now();
    const queries = buildCompetitorQueries({
      companyName: youName,
      host,
      market,
      statement: youStatement,
    });
    const searchBudget = Math.min(SEARCH_TIMEOUT_MS, Math.max(2500, remaining() - 7000));
    // Primary query — "closest competitors to {name} {host} …"
    const search = await withTimeout(
      webSearch(queries[0], {
        count: 12,
        timeoutMs: searchBudget,
        skipQueue: true,
        noResearchFallback: true,
      }),
      searchBudget + 500,
      'webSearchRivals'
    );
    rivalText = flattenYouPayload(search) || search?.text || '';
    rivalSources = Array.isArray(search?.sources) ? search.sources : [];

    const evidenceOpts = { host, companyName: youName };
    // Second search when primary looks like name-collision noise (e.g. Remi AI logistics).
    if (!rivalEvidenceLooksUseful(rivalText, evidenceOpts) && queries[1] && remaining() > 9000) {
      const search2 = await withTimeout(
        webSearch(queries[1], {
          count: 10,
          timeoutMs: Math.min(SEARCH_TIMEOUT_MS, remaining() - 7000),
          skipQueue: true,
          noResearchFallback: true,
        }),
        SEARCH_TIMEOUT_MS + 400,
        'webSearchRivals2'
      );
      const text2 = flattenYouPayload(search2) || search2?.text || '';
      rivalText = [rivalText, text2].filter(Boolean).join('\n\n');
      rivalSources = [...rivalSources, ...(Array.isArray(search2?.sources) ? search2.sources : [])];
    }
    timings.searchMs = Date.now() - tSearch;
  } catch {
    timings.searchMs = null;
    partial = true;
  }

  // Prefer research lite when web search did not surface same-class peers,
  // or always for AI app-builder / product-agent class (search often hits name collisions).
  const appBuilderClass = isAiAppBuilderClass(market, youStatement);
  if (
    remaining() > 4500
    && (appBuilderClass || !rivalEvidenceLooksUseful(rivalText, { host, companyName: youName }))
  ) {
    try {
      const tRes = Date.now();
      const liteBudget = Math.min(RESEARCH_LITE_TIMEOUT_MS, Math.max(3500, remaining() - 4000));
      const lite = await researchLiteCompetitors({
        companyName: youName,
        host,
        market,
        statement: youStatement,
        userUrl: url,
        timeoutMs: liteBudget,
      });
      timings.researchMs = Date.now() - tRes;
      usedResearchLite = true;
      if (lite.text) rivalText = [lite.text, rivalText].filter(Boolean).join('\n\n');
      if (lite.sources?.length) rivalSources = [...lite.sources, ...rivalSources];
    } catch {
      timings.researchMs = null;
      partial = true;
    }
  }

  // --- 4) Grok rivals (+ snippet prices) ---
  try {
    const tExtract = Date.now();
    const extractBudget = Math.min(6500, Math.max(2500, remaining() - 2500));
    const extracted = await withTimeout(
      extractRivalsFromSearch({
        host,
        userUrl: url,
        companyName: youName,
        market,
        searchText: rivalText,
      }),
      extractBudget,
      'extractRivals'
    );
    timings.extractMs = Date.now() - tExtract;
    rivals = mergeRivals(extracted.rivals || [], rivalsFromSearchSources(rivalSources, host), host);
  } catch {
    timings.extractMs = null;
    partial = true;
    rivals = rivalsFromSearchSources(rivalSources, host);
  }

  // If extract still thin, force research-lite once more then re-extract.
  if (rivals.length < 2 && remaining() > 4000) {
    try {
      if (!usedResearchLite) {
        const tRes = Date.now();
        const liteBudget = Math.min(RESEARCH_LITE_TIMEOUT_MS, remaining() - 2000);
        const lite = await researchLiteCompetitors({
          companyName: youName,
          host,
          market,
          statement: youStatement,
          userUrl: url,
          timeoutMs: liteBudget,
        });
        timings.researchMs = Date.now() - tRes;
        usedResearchLite = true;
        rivalText = [lite.text, rivalText].filter(Boolean).join('\n\n');
      }
      if (rivalText && remaining() > 2000) {
        const extracted = await withTimeout(
          extractRivalsFromSearch({
            host,
            userUrl: url,
            companyName: youName,
            market,
            searchText: rivalText,
          }),
          Math.min(4500, remaining() - 400),
          'extractRivalsLite'
        );
        rivals = mergeRivals(extracted.rivals || [], rivals, host);
      }
    } catch {
      partial = true;
    }
  }

  // Named-mention fallback (Lovable/Bolt/…) when extract under-fills same-class peers.
  rivals = mergeRivals(rivals, rivalsFromNamedMentions(rivalText, host), host);

  if (!rivals.length) {
    rivals = rivalsFromSearchSources(rivalSources, host);
    if (rivals.length) partial = true;
  } else if (rivals.length < Math.min(3, MAX_RIVALS)) {
    rivals = mergeRivals(rivals, rivalsFromSearchSources(rivalSources, host), host);
  }

  // Also scrape your price from about snippets if present.
  const youSnippetPrice = scrapeEntryPrice(aboutText);
  if (youSnippetPrice != null) you = { ...you, entry_price: youSnippetPrice };

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
      ...(r.entry_price != null ? { entry_price: r.entry_price } : {}),
    })),
  });

  // --- 5) Optional snippet price enrichment (no Contents) ---
  await emit('status', { step: 'plot', label: 'Plotting map…' });
  const unpriced = [you, ...rivals].filter((r) => r && r.entry_price == null).length;
  if (unpriced > 0 && remaining() > 2800) {
    try {
      const tPrice = Date.now();
      const { youPrice, rivalPrices } = await enrichPricesFromSearch({
        you,
        rivals,
        remainingMs: remaining,
      });
      timings.priceMs = Date.now() - tPrice;
      if (youPrice != null) you = { ...you, entry_price: youPrice };
      rivals = rivals.map((r, i) => {
        const keyR = `rival:${i}`;
        const entry_price = r.entry_price ?? rivalPrices[keyR] ?? null;
        return { ...r, entry_price };
      });
    } catch {
      timings.priceMs = null;
      partial = true;
    }
  }

  await emit('rival', { role: 'you', ...you });
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

  await emit('pricing', { you: scored.you, rivals: scored.rivals });
  await emit('done', payload);

  // Cache useful results: real identity + same-class rivals (prices optional — n/a lane works).
  const identityOk = scored.you?.name && !USELESS_MARKET_RE.test(market) && !/^Marketing tools$/i.test(market);
  if (key && scored.rivals.length >= 2 && identityOk) {
    setCached(key, payload);
  }

  return payload;
}

// tiny helper export for tests
export const __demoFastInternals = {
  scrapeEntryPrice,
  cache,
  normalizeUrl,
  hostnameOf,
  sanitizeMarket,
  fallbackMarketLabel,
  clampStatement,
  buildCompetitorQueries,
  rivalEvidenceLooksUseful,
  knownWebsiteForName,
  rivalsFromNamedMentions,
  isAiAppBuilderClass,
  KNOWN_PRODUCT_DOMAINS,
};
