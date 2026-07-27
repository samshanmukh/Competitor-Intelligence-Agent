/**
 * App Store / Play Store pricing fallback when a competitor has no useful
 * website pricing page. Discovers store listing URLs, scrapes them, and
 * returns text + source links for tier extraction.
 *
 * App Store In-App Purchases are often missing from generic scrapers (You.com),
 * so we also fetch the apps.apple.com HTML and parse the IAP text-pairs that
 * Apple embeds server-side (visible under the In-App Purchases disclosure).
 */

import { research, webSearch, fetchContents } from './youcom.js';

const APPLE_RE = /https?:\/\/apps\.apple\.com\/[^\s"'<>)]+/gi;
const PLAY_RE = /https?:\/\/play\.google\.com\/store\/apps\/[^\s"'<>)]+/gi;

const APP_STORE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function cleanUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim().replace(/[),.]+$/, ''));
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function isAppStoreUrl(url) {
  return /apps\.apple\.com\//i.test(String(url || ''));
}

export function isPlayStoreUrl(url) {
  return /play\.google\.com\/store\/apps\//i.test(String(url || ''));
}

export function isStoreUrl(url) {
  return isAppStoreUrl(url) || isPlayStoreUrl(url);
}

export function storeSourceType(url) {
  if (isAppStoreUrl(url)) return 'app-store';
  if (isPlayStoreUrl(url)) return 'play-store';
  return 'pricing_page';
}

export function storeSourceLabel(type, url) {
  if (type === 'app-store' || isAppStoreUrl(url)) return 'App Store';
  if (type === 'play-store' || isPlayStoreUrl(url)) return 'Play Store';
  if (type === 'you-research' || type === 'research') return 'Research';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Pricing page';
  }
}

function extractStoreUrlsFromText(text) {
  const blob = String(text || '');
  const apple = [...blob.matchAll(APPLE_RE)].map((m) => cleanUrl(m[0])).filter(Boolean);
  const play = [...blob.matchAll(PLAY_RE)].map((m) => cleanUrl(m[0])).filter(Boolean);
  return {
    appStore: apple[0] || null,
    playStore: play[0] || null,
  };
}

function pickFromSources(sources = []) {
  let appStore = null;
  let playStore = null;
  for (const s of sources) {
    const url = cleanUrl(s?.url);
    if (!url) continue;
    if (!appStore && isAppStoreUrl(url)) appStore = url;
    if (!playStore && isPlayStoreUrl(url)) playStore = url;
  }
  return { appStore, playStore };
}

function namesLooselyMatch(a, b) {
  const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const aTokens = left.split(/\s+/).filter((t) => t.length > 2);
  const bTokens = new Set(right.split(/\s+/).filter((t) => t.length > 2));
  if (!aTokens.length) return false;
  const overlap = aTokens.filter((t) => bTokens.has(t)).length;
  return overlap / aTokens.length >= 0.5;
}

/**
 * Apple's free Search API — reliable App Store listing URLs (and list price).
 */
async function findAppStoreViaItunes(name, website) {
  if (!name && !website) return null;
  const term = name || website;
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=8`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(to);
    if (!res.ok) return null;
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return null;

    let best = results.find((r) => namesLooselyMatch(r.trackName, name));
    if (!best && website) {
      try {
        const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
        best = results.find((r) => String(r.sellerUrl || r.artistViewUrl || '').includes(host));
      } catch { /* ignore */ }
    }
    best = best || results[0];
    const view = cleanUrl(best?.trackViewUrl);
    if (!view) return null;

    // Include list price / IAP hints from the lookup payload when present.
    const priceBits = [];
    if (best.formattedPrice) priceBits.push(`List price: ${best.formattedPrice}`);
    if (best.price != null) priceBits.push(`price_usd: ${best.price}`);
    if (Array.isArray(best.genres)) priceBits.push(`genres: ${best.genres.join(', ')}`);

    return {
      appStore: view,
      metaText: [
        `App Store: ${best.trackName || name}`,
        best.sellerName ? `Seller: ${best.sellerName}` : null,
        ...priceBits,
        best.description ? `Description: ${String(best.description).slice(0, 1200)}` : null,
      ].filter(Boolean).join('\n'),
    };
  } catch {
    return null;
  }
}

/**
 * Find App Store / Play Store listing URLs for a product via iTunes + search + research.
 */
export async function findStoreUrls({ name, website } = {}) {
  if (!name && !website) return { appStore: null, playStore: null, sources: [], itunesMeta: null };

  let appStore = null;
  let playStore = null;
  let itunesMeta = null;
  const foundSources = [];

  const itunes = await findAppStoreViaItunes(name, website);
  if (itunes?.appStore) {
    appStore = itunes.appStore;
    itunesMeta = itunes.metaText || null;
    foundSources.push({
      type: 'app-store',
      url: appStore,
      title: `${name || 'App'} · App Store`,
      label: 'App Store',
    });
  }

  const brand = name || website;
  const queries = [
    `"${brand}" site:apps.apple.com`,
    `"${brand}" site:play.google.com/store/apps`,
    `${brand} app store in-app purchases subscription price`,
    `${brand} google play in-app purchases subscription`,
  ];

  for (const q of queries) {
    if (appStore && playStore) break;
    try {
      const hit = await webSearch(q, { count: 6 });
      const fromHits = pickFromSources(hit.sources);
      appStore = appStore || fromHits.appStore;
      playStore = playStore || fromHits.playStore;
      const fromText = extractStoreUrlsFromText(hit.text);
      appStore = appStore || fromText.appStore;
      playStore = playStore || fromText.playStore;
      for (const s of hit.sources || []) {
        if (isStoreUrl(s.url)) foundSources.push(s);
      }
    } catch {
      /* try next query */
    }
  }

  if (!appStore || !playStore) {
    try {
      const payload = await research(
        `${brand}${website ? ` (${website})` : ''} official iOS App Store and Google Play Store listing URLs. Prefer apps.apple.com and play.google.com/store/apps links. Also note subscription / in-app purchase prices if listed on those pages.`,
        { effort: 'lite' }
      );
      const blob = [
        payload?.output?.content,
        ...(payload?.output?.sources || []).map((s) => `${s.title} ${s.url} ${(s.snippets || []).join(' ')}`),
      ].join('\n');
      const fromText = extractStoreUrlsFromText(blob);
      const fromSrc = pickFromSources(payload?.output?.sources || []);
      appStore = appStore || fromSrc.appStore || fromText.appStore;
      playStore = playStore || fromSrc.playStore || fromText.playStore;
      for (const s of payload?.output?.sources || []) {
        if (isStoreUrl(s.url)) foundSources.push(s);
      }
    } catch {
      /* optional */
    }
  }

  return { appStore, playStore, sources: foundSources, itunesMeta };
}

/** Lenient gate for App Store / Play Store / IAP research text. */
export function contentLooksLikeStorePricing(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 40) return false;
  if (/\$\s?\d/.test(t)) return true;
  if (/\b(in-?app purchases?|subscription|weekly|monthly|yearly|\/mo|\/yr|per week|per month|per year)\b/i.test(t)
    && t.length >= 250) {
    return true;
  }
  return t.length >= 700;
}

/**
 * Parse In-App Purchase name/price pairs from apps.apple.com HTML.
 * Apple embeds these as text-pair rows and as JSON `textPairs` / leadingText+trailingText.
 */
export function extractAppStoreIapFromHtml(html) {
  const pairs = [];
  const seen = new Set();
  const add = (name, price) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    let p = String(price || '').replace(/\s+/g, ' ').trim();
    if (!n || n.length > 120) return;
    if (!p) return;
    if (!/^\$/.test(p) && /^\d/.test(p)) p = `$${p}`;
    if (!/\$\s?\d/.test(p)) return;
    // Skip noise from SVG path coordinates accidentally matching.
    if (/^\$?\d{2,}\.\d{3,}/.test(p)) return;
    const key = `${n.toLowerCase()}|${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ name: n, price: p });
  };

  const blob = String(html || '');

  for (const m of blob.matchAll(/"textPairs"\s*:\s*\[([\s\S]*?)\]/g)) {
    for (const pair of m[1].matchAll(/\[\s*"([^"]+)"\s*,\s*"(\$[^"]+)"\s*\]/g)) {
      add(pair[1], pair[2]);
    }
  }

  for (const m of blob.matchAll(/"leadingText"\s*:\s*"([^"]+)"\s*,\s*"trailingText"\s*:\s*"(\$[^"]+)"/g)) {
    add(m[1], m[2]);
  }

  for (const m of blob.matchAll(
    /class="[^"]*text-pair[^"]*"[^>]*>\s*<span>([^<]+)<\/span>\s*<span>(\$[^<]+)<\/span>/gi
  )) {
    add(m[1], m[2]);
  }

  // Broader fallback: <span>Name</span> <span>$X.XX</span> near In-App Purchases.
  const iapIdx = blob.search(/In-App Purchases/i);
  if (iapIdx >= 0) {
    const slice = blob.slice(iapIdx, iapIdx + 12000);
    for (const m of slice.matchAll(/<span>([^<]{2,80})<\/span>\s*<span>(\$\d[\d,]*(?:\.\d{2})?)<\/span>/gi)) {
      add(m[1], m[2]);
    }
  }

  return pairs;
}

async function fetchAppStorePageHtml(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': APP_STORE_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

/**
 * Fetch App Store listing HTML and return structured IAP pricing text.
 * Returns null when no IAP / paid list price is found.
 */
export async function fetchAppStoreIapText(url) {
  const pageUrl = cleanUrl(url);
  if (!pageUrl || !isAppStoreUrl(pageUrl)) return null;

  const html = await fetchAppStorePageHtml(pageUrl);
  if (!html) return null;

  const pairs = extractAppStoreIapFromHtml(html);
  let listLine = null;
  try {
    const ld = html.match(/<script[^>]*id=["']?software-application["']?[^>]*>([\s\S]*?)<\/script>/i);
    if (ld) {
      const data = JSON.parse(ld[1]);
      const offer = Array.isArray(data?.offers) ? data.offers[0] : data?.offers;
      const price = offer?.price;
      const currency = offer?.priceCurrency || 'USD';
      if (price != null && Number(price) > 0) {
        listLine = `List price: ${currency === 'USD' ? '$' : ''}${price}${currency !== 'USD' ? ` ${currency}` : ''}`;
      } else if (price === 0 || price === '0') {
        listLine = 'List price: Free';
      }
      if (data?.name) {
        listLine = [`App: ${data.name}`, listLine].filter(Boolean).join('\n');
      }
    }
  } catch {
    /* ignore malformed ld+json */
  }

  if (!pairs.length && !listLine) return null;

  const lines = [
    `App Store In-App Purchases (${pageUrl})`,
    listLine,
    pairs.length ? 'In-App Purchases:' : null,
    ...pairs.map((p) => `- ${p.name}: ${p.price}`),
  ].filter(Boolean);

  return {
    text: lines.join('\n'),
    pairs,
    url: pageUrl,
  };
}

/**
 * Scrape App Store / Play Store pages and return usable pricing text + sources.
 * Returns null when no useful store content is found.
 */
export async function fetchStorePricingContent(competitor = {}) {
  const name = competitor.name;
  const website = competitor.website;
  const known = [competitor.pricing_url, competitor.app_store_url, competitor.play_store_url]
    .map(cleanUrl)
    .filter(Boolean);

  let appStore = known.find(isAppStoreUrl) || null;
  let playStore = known.find(isPlayStoreUrl) || null;
  let itunesMeta = null;

  if (!appStore || !playStore) {
    const found = await findStoreUrls({ name, website });
    appStore = appStore || found.appStore;
    playStore = playStore || found.playStore;
    itunesMeta = found.itunesMeta || null;
  }

  const urls = [appStore, playStore].filter(Boolean);
  const parts = [];
  const sources = [];

  // Direct App Store HTML parse — catches IAP that generic scrapers miss.
  if (appStore) {
    try {
      const iap = await fetchAppStoreIapText(appStore);
      if (iap?.text && /\$\s?\d/.test(iap.text)) {
        parts.push(`== App Store In-App Purchases (${appStore}) ==\n${iap.text}`);
        sources.push({
          type: 'app-store',
          url: appStore,
          title: `${name || 'App'} · App Store`,
          label: 'App Store',
        });
      }
    } catch {
      /* fall through to You.com / research */
    }
  }

  if (itunesMeta) {
    parts.push(`== App Store metadata (iTunes Search) ==\n${itunesMeta}`);
  }

  if (urls.length) {
    let map = {};
    try {
      map = await fetchContents(urls);
    } catch {
      map = {};
    }

    for (const url of urls) {
      const md = map[url]?.markdown;
      if (!contentLooksLikeStorePricing(md)) continue;
      // Skip redundant App Store scrape when we already have IAP dollars.
      if (isAppStoreUrl(url) && parts.some((p) => p.includes('In-App Purchases') && /\$\s?\d/.test(p))) {
        continue;
      }
      const type = storeSourceType(url);
      const label = storeSourceLabel(type, url);
      parts.push(`== ${label} (${url}) ==\n${md.slice(0, 5000)}`);
      if (!sources.some((s) => s.url === url)) {
        sources.push({
          type,
          url,
          title: `${name || 'App'} · ${label}`,
          label,
        });
      }
    }
  }

  // Prefer scraped store pages; if thin, research IAP prices explicitly.
  if (!parts.some((p) => /\$\s?\d/.test(p)) || !sources.length) {
    try {
      const payload = await research(
        `${name || website} App Store and Google Play in-app purchase and subscription prices. List every tier with weekly/monthly/yearly USD when shown on the store listing. Include plan names.`,
        { effort: 'medium' }
      );
      const text = [
        payload?.output?.content,
        ...(payload?.output?.sources || []).slice(0, 10).map((s) => (
          [s.title, s.url, (s.snippets || []).join(' ')].filter(Boolean).join(' — ')
        )),
      ].filter(Boolean).join('\n').trim();
      if (contentLooksLikeStorePricing(text)) {
        parts.push(`== Store pricing research ==\n${text.slice(0, 6000)}`);
        const fromSrc = pickFromSources(payload?.output?.sources || []);
        const fromText = extractStoreUrlsFromText(text);
        appStore = appStore || fromSrc.appStore || fromText.appStore;
        playStore = playStore || fromSrc.playStore || fromText.playStore;
        for (const url of [appStore, playStore].filter(Boolean)) {
          if (sources.some((s) => s.url === url)) continue;
          sources.push({
            type: storeSourceType(url),
            url,
            title: `${name || 'App'} · ${storeSourceLabel(storeSourceType(url), url)}`,
            label: storeSourceLabel(storeSourceType(url), url),
          });
        }
        if (!sources.length) {
          sources.push({
            type: 'research',
            url: null,
            title: 'Store pricing research',
            label: 'Store research',
          });
        }
      }
    } catch {
      /* optional */
    }
  }

  const content = parts.join('\n\n').trim();
  if (!contentLooksLikeStorePricing(content)) return null;

  return {
    content: content.slice(0, 12000),
    sources,
    appStore,
    playStore,
    kind: sources.some((s) => s.type === 'app-store') && sources.some((s) => s.type === 'play-store')
      ? 'app-store+play-store'
      : sources[0]?.type || (appStore ? 'app-store' : 'store-research'),
  };
}
