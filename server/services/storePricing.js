/**
 * App Store / Play Store pricing fallback when a competitor has no useful
 * website pricing page. Discovers store listing URLs, scrapes them, and
 * returns text + source links for tier extraction.
 */

import { research, webSearch, fetchContents } from './youcom.js';

const APPLE_RE = /https?:\/\/apps\.apple\.com\/[^\s"'<>)]+/gi;
const PLAY_RE = /https?:\/\/play\.google\.com\/store\/apps\/[^\s"'<>)]+/gi;

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

/**
 * Find App Store / Play Store listing URLs for a product via search + research.
 */
export async function findStoreUrls({ name, website } = {}) {
  if (!name && !website) return { appStore: null, playStore: null, sources: [] };
  const brand = name || website;
  const queries = [
    `"${brand}" site:apps.apple.com`,
    `"${brand}" site:play.google.com/store/apps`,
    `${brand} app store subscription in-app purchase pricing`,
  ];

  let appStore = null;
  let playStore = null;
  const foundSources = [];

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
        `${brand}${website ? ` (${website})` : ''} official iOS App Store and Google Play Store listing URLs. Prefer apps.apple.com and play.google.com/store/apps links. Also note subscription / in-app purchase prices if listed.`,
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

  return { appStore, playStore, sources: foundSources };
}

function contentLooksLikeStorePricing(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 200) return false;
  if (/\$\s?\d/.test(t)) return true;
  if (/\b(in-?app purchases?|subscription|weekly|monthly|yearly|\/mo|\/yr)\b/i.test(t) && t.length >= 350) {
    return true;
  }
  return t.length >= 900;
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

  if (!appStore || !playStore) {
    const found = await findStoreUrls({ name, website });
    appStore = appStore || found.appStore;
    playStore = playStore || found.playStore;
  }

  const urls = [appStore, playStore].filter(Boolean);
  if (!urls.length) return null;

  let map = {};
  try {
    map = await fetchContents(urls);
  } catch {
    return null;
  }

  const parts = [];
  const sources = [];

  for (const url of urls) {
    const md = map[url]?.markdown;
    if (!contentLooksLikeStorePricing(md)) continue;
    const type = storeSourceType(url);
    const label = storeSourceLabel(type, url);
    parts.push(`== ${label} (${url}) ==\n${md.slice(0, 5000)}`);
    sources.push({
      type,
      url,
      title: `${name || 'App'} · ${label}`,
      label,
    });
  }

  if (!parts.length) {
    // Research fallback specifically about store IAP pricing (no listing scrape).
    try {
      const payload = await research(
        `${name || website} App Store and Google Play subscription prices in-app purchases tiers weekly monthly yearly USD`,
        { effort: 'lite' }
      );
      const text = [
        payload?.output?.content,
        ...(payload?.output?.sources || []).slice(0, 8).map((s) => (
          [s.title, s.url, (s.snippets || []).join(' ')].filter(Boolean).join(' — ')
        )),
      ].filter(Boolean).join('\n').trim();
      if (contentLooksLikeStorePricing(text)) {
        const fromSrc = pickFromSources(payload?.output?.sources || []);
        const fromText = extractStoreUrlsFromText(text);
        const storeUrls = [
          fromSrc.appStore || fromText.appStore,
          fromSrc.playStore || fromText.playStore,
        ].filter(Boolean);
        for (const url of storeUrls) {
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
        return {
          content: text.slice(0, 8000),
          sources,
          appStore: storeUrls.find(isAppStoreUrl) || null,
          playStore: storeUrls.find(isPlayStoreUrl) || null,
          kind: 'store-research',
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  return {
    content: parts.join('\n\n').slice(0, 10000),
    sources,
    appStore,
    playStore,
    kind: sources.some((s) => s.type === 'app-store') && sources.some((s) => s.type === 'play-store')
      ? 'app-store+play-store'
      : sources[0]?.type || 'app-store',
  };
}
