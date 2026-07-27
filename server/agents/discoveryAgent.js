// Discovery agent: turns a market description (and/or a product URL) into a
// structured list of candidate competitors with pricing page URLs.
//
// Flow:
//   1. (optional) If a product URL is given, fetch it and let Grok infer the market.
//   2. Query the You.com Research API for competitors with pricing pages.
//   3. Use Grok to extract clean, structured {name, website, pricing_url, notes}.

import { research, fetchContents } from '../services/youcom.js';
import { complete, completeJSON } from '../services/ai.js';

const EXTRACT_SYSTEM = `You are a market research analyst. You extract structured competitor data from web research.
Return ONLY valid JSON. Never invent URLs — only use URLs present in the provided research text.`;

/**
 * Infer a concise market description from a product website's content.
 */
export async function inferMarketFromUrl(productUrl) {
  const contents = await fetchContents([productUrl]);
  const md = contents[productUrl]?.markdown;
  if (!md) {
    throw new Error(
      contents[productUrl]?.error || `Could not read ${productUrl} (the site may block scrapers).`
    );
  }
  const summary = await complete({
    system: 'You summarize what a company does in one or two sentences for competitor research.',
    user: `Here is the markdown of a company's website. In 1-2 sentences, describe the product/market so I can find competitors. Be specific about the category and target user.\n\n${md.slice(0, 8000)}`,
    maxTokens: 200,
  });
  return summary.trim();
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
  return { market, candidates };
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

export const discoveryAgent = { discoverCompetitors, inferMarketFromUrl };
