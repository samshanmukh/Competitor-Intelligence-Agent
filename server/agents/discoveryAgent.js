// Discovery agent: turns a market description (and/or a product URL) into a
// structured list of candidate competitors with pricing page URLs.
//
// Flow:
//   1. (optional) If a product URL is given, webSearch for company identity
//      (title/snippets), then Grok → name + market description. Contents is
//      NOT used for identity — only for later pricing-page scrapes.
//   2. Query the You.com Research API for competitors with pricing pages.
//   3. Use Grok to extract clean, structured {name, website, pricing_url, notes}.

import { research, searchAboutUrl, directFetchPageText } from '../services/youcom.js';
import { completeJSON } from '../services/ai.js';
import { findStoreUrls, fetchAppStoreIapText, isStoreUrl } from '../services/storePricing.js';

const EXTRACT_SYSTEM = `You are a market research analyst. You extract structured competitor data from web research.
Return ONLY valid JSON. Never invent URLs — only use URLs present in the provided research text.`;

const IDENTITY_SYSTEM = `You extract a product/company identity from web search results.
Return ONLY valid JSON: { "name": string, "description": string }.
- name: short product or company name (not a full sentence)
- description: 1-2 sentences on what it does, category, and target user
Use only facts present in the evidence. If the name is unclear, use the best short label from the title.`;

/**
 * Search-first company identity for a product URL.
 * Primary: You.com webSearch about the URL. Rare last resort: direct HTML meta.
 * Returns { name, description, source }.
 */
export async function inferProductFromUrl(productUrl) {
  const url = String(productUrl || '').trim();
  if (!url) throw new Error('Product URL required');

  let evidence = '';
  let source = null;
  let searchError = null;

  const found = await searchAboutUrl(url, {
    skipQueue: true,
    timeoutMs: 15000,
    count: 6,
  });
  if (found.markdown) {
    evidence = found.markdown;
    source = found.source || 'youcom-search';
  } else {
    searchError = found.error;
  }

  // Rare last resort only — do not block identity on Contents/SPA scrapes.
  if (!evidence) {
    try {
      const direct = await directFetchPageText(url, { timeoutMs: 12000 });
      if (direct.markdown) {
        evidence = direct.markdown;
        source = direct.source || 'direct';
      }
    } catch {
      /* keep search error */
    }
  }

  if (!evidence) {
    throw new Error(
      searchError
        || `Could not find company info for ${url}. Try another URL or describe the product manually.`
    );
  }

  let name = '';
  let description = '';
  try {
    const extracted = await completeJSON({
      system: IDENTITY_SYSTEM,
      user: `Product URL: ${url}\n\nSearch / page evidence:\n${evidence.slice(0, 6000)}`,
      maxTokens: 300,
    });
    name = String(extracted?.name || '').trim();
    description = String(extracted?.description || '').trim();
  } catch {
    /* fall through to title/snippet heuristic */
  }

  if (!description) {
    // Heuristic: first non-URL line as title, second as blurb.
    const lines = evidence.split('\n').map((l) => l.trim()).filter(Boolean)
      .filter((l) => !/^https?:\/\//i.test(l));
    const title = lines[0] || '';
    const blurb = lines.find((l, i) => i > 0 && l.length > 40) || lines.slice(1).join(' ');
    if (!name && title) {
      name = title.split(/[–—|:·-]/)[0].trim().slice(0, 80);
    }
    description = [title, blurb].filter(Boolean).join(' — ').slice(0, 500);
  }

  if (!description) {
    throw new Error(`Could not find company info for ${url}. Try another URL or describe the product manually.`);
  }

  return { name: name || null, description, source, evidence };
}

/**
 * Infer a concise market description from a product URL (search-first).
 * Kept for discoverCompetitors and older callers that expect a string.
 */
export async function inferMarketFromUrl(productUrl) {
  const { description } = await inferProductFromUrl(productUrl);
  return description;
}

/**
 * Pull a compact, text-only view out of the You.com research payload so we can
 * feed it to Grok for extraction (and keep token usage reasonable).
 *
 * Supports new format: { output: { content, sources: [{url, title, snippets}] } }
 * and legacy format:   { answer, results: [{title, url, snippet}], ... }
 */
function flattenResearch(payload) {
  const parts = [];
  const push = (v) => {
    if (typeof v === 'string' && v.trim()) parts.push(v.trim());
  };

  // New format (2026): { output: { content, sources: [{url, title, snippets:[]}] } }
  if (payload.output) {
    push(payload.output.content);
    for (const src of payload.output.sources || []) {
      const snippetText = (src.snippets || []).join(' ');
      const line = [src.title, src.url, snippetText].filter(Boolean).join(' — ');
      push(line);
    }
  }

  // Legacy fallbacks: { answer, results/search_results/web_results/sources/citations/hits }
  push(payload.answer);
  push(payload.summary);
  push(payload.text);

  const buckets = [
    payload.results,
    payload.search_results,
    payload.web_results,
    payload.sources,
    payload.citations,
    payload.hits,
  ];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (typeof item === 'string') { push(item); continue; }
      const line = [item.title || item.name, item.url || item.link, item.snippet || item.description || item.text]
        .filter(Boolean).join(' — ');
      push(line);
    }
  }

  return parts.join('\n').slice(0, 16000);
}

/**
 * Run discovery for a market description. Returns { market, candidates: [...] }.
 */
export async function discoverCompetitors({ description, productUrl, maxResults = 12 }) {
  let market = (description || '').trim();

  if (productUrl && !market) {
    market = await inferMarketFromUrl(productUrl);
  } else if (productUrl && market) {
    // Enrich the user's description with what the product page says.
    try {
      const inferred = await inferMarketFromUrl(productUrl);
      market = `${market}\n\nProduct site context: ${inferred}`;
    } catch {
      // Non-fatal — proceed with the user's description alone.
    }
  }

  if (!market) {
    throw new Error('Provide a market description or a product URL to discover competitors.');
  }

  const query = `Top competitors for ${market}. List company names, their websites, and each company's pricing page URL. If a product is mobile-first with no public pricing page, include its App Store (apps.apple.com) or Google Play (play.google.com/store/apps) listing URL instead.`;
  const payload = await research(query);
  const researchText = flattenResearch(payload);

  if (!researchText) {
    return { market, candidates: [] };
  }

  const extraction = await completeJSON({
    system: EXTRACT_SYSTEM,
    user: `From the research below, extract up to ${maxResults} real competitors in this market:

"${market}"

For each competitor return:
- name: company/product name
- website: homepage URL
- pricing_url: the pricing page URL (prefer a URL containing "pricing" or "plans"). If the product is mobile-first or has no public web pricing, prefer the apps.apple.com or play.google.com/store/apps listing URL (in-app purchase / subscription prices are listed there). Otherwise construct the most likely https://site.com/pricing from the homepage.
- notes: one short phrase on why it's a competitor

Only include companies that actually appear in the research text. Do not invent companies.

Return JSON shaped exactly as: { "competitors": [ { "name": "", "website": "", "pricing_url": "", "notes": "" } ] }

RESEARCH:
${researchText}`,
    maxTokens: 2000,
  });

  const candidates = normalizeCandidates(extraction?.competitors || extraction || []);
  // For every discovered rival, find App/Play Store listings and prefer the
  // App Store URL when In-App Purchase prices are listed there.
  const withStores = await attachStoreListings(candidates);
  return { market, candidates: withStores };
}

/**
 * Look up App Store / Play Store for each candidate. When IAP prices exist on
 * the App Store listing, use that URL as pricing_url so refresh/analysis pick them up.
 */
async function attachStoreListings(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return candidates || [];

  const out = new Array(candidates.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      const i = cursor++;
      const c = candidates[i];
      try {
        out[i] = await attachStoreListing(c);
      } catch {
        out[i] = c;
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function attachStoreListing(c) {
  const found = await findStoreUrls({ name: c.name, website: c.website });
  if (!found?.appStore && !found?.playStore) return c;

  let pricing_url = c.pricing_url;
  const noteBits = [c.notes].filter(Boolean);

  if (found.appStore) {
    let hasIap = false;
    try {
      const iap = await fetchAppStoreIapText(found.appStore);
      hasIap = Boolean(iap?.pairs?.length);
    } catch {
      hasIap = false;
    }

    if (hasIap) {
      // Mobile-priced product — App Store IAP is the source of truth for tiers.
      pricing_url = found.appStore;
      noteBits.push('App Store In-App Purchases');
    } else if (!pricing_url || /\/pricing\/?$/i.test(pricing_url)) {
      // Keep website pricing when present; otherwise use the store listing.
      if (!pricing_url) pricing_url = found.appStore;
      noteBits.push(`App Store: ${found.appStore}`);
    } else if (!isStoreUrl(pricing_url)) {
      noteBits.push(`App Store: ${found.appStore}`);
    }
  }

  if (found.playStore && !isStoreUrl(pricing_url)) {
    noteBits.push(`Play Store: ${found.playStore}`);
  }

  return {
    ...c,
    pricing_url: pricing_url || c.pricing_url,
    notes: noteBits.length ? noteBits.join(' · ') : c.notes,
  };
}

function normalizeCandidates(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    let pricing_url = (c.pricing_url || c.pricingUrl || c.url || c.app_store_url || c.play_store_url || '').trim();
    let website = (c.website || c.homepage || '').trim();
    const name = (c.name || c.company || '').trim();
    if (!name) continue;

    // Prefer website /pricing; allow App Store / Play Store when no web pricing page exists.
    if (!pricing_url && website) pricing_url = joinUrl(website, '/pricing');
    if (!website && pricing_url && !/apps\.apple\.com|play\.google\.com/i.test(pricing_url)) {
      website = origin(pricing_url);
    }
    if (!pricing_url) continue;

    pricing_url = ensureHttp(pricing_url);
    website = website ? ensureHttp(website) : null;

    const key = pricing_url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const notes = (c.notes || c.reason || '').trim() || null;
    out.push({ name, website, pricing_url, notes });
  }
  return out;
}

function ensureHttp(u) {
  if (!/^https?:\/\//i.test(u)) return `https://${u.replace(/^\/+/, '')}`;
  return u;
}

function origin(u) {
  try {
    return new URL(ensureHttp(u)).origin;
  } catch {
    return null;
  }
}

function joinUrl(base, path) {
  try {
    return new URL(path, ensureHttp(base)).href;
  } catch {
    return ensureHttp(base);
  }
}

export const discoveryAgent = { discoverCompetitors, inferMarketFromUrl, inferProductFromUrl };
