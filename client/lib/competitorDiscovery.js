const DIRECTORY_HOSTS = new Set([
  'alternativeto.net',
  'capterra.com',
  'facebook.com',
  'g2.com',
  'instagram.com',
  'linkedin.com',
  'producthunt.com',
  'reddit.com',
  'tiktok.com',
  'wikipedia.org',
  'x.com',
  'youtube.com',
]);
const CONTENT_PATH_RE = /\/(?:alternatives?|blog|competitors?|picks?|reviews?)(?:\/|$)/i;

function ensureHttp(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  try {
    const url = new URL(normalized);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function bareHost(value) {
  try {
    return new URL(ensureHttp(value)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function searchHits(payload) {
  const raw = payload?.results;
  const buckets = [
    ...(Array.isArray(raw) ? [raw] : []),
    ...(Array.isArray(raw?.web) ? [raw.web] : []),
    ...(Array.isArray(payload?.hits) ? [payload.hits] : []),
    ...(Array.isArray(payload?.web_results) ? [payload.web_results] : []),
  ];
  return buckets.flat().map((item) => ({
    title: String(item?.title || item?.name || '').trim(),
    url: ensureHttp(item?.url || item?.link || item?.source_url),
    snippet: String(
      item?.snippet || item?.description || item?.content
      || (Array.isArray(item?.snippets) ? item.snippets.join(' ') : '')
    ).trim(),
  })).filter((item) => item.url);
}

function displayName(title, host) {
  const first = String(title || '').split(/\s+[|–—:]\s+|\s+-\s+/)[0].trim();
  if (first && first.length <= 60 && !/^(best|top|the|compare|alternatives?\b)/i.test(first)) return first;
  const label = host.split('.')[0].replace(/[-_]+/g, ' ');
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeCandidates(list, productUrl = '', limit = 8) {
  if (!Array.isArray(list)) return [];
  const ownHost = bareHost(productUrl);
  const seen = new Set();
  const candidates = [];

  for (const item of list) {
    const pricingUrl = ensureHttp(item?.pricing_url || item?.pricingUrl || item?.url || item?.website);
    const website = ensureHttp(item?.website || pricingUrl);
    const host = bareHost(website || pricingUrl);
    if (!pricingUrl || !host || host === ownHost || DIRECTORY_HOSTS.has(host)) continue;
    if (CONTENT_PATH_RE.test(new URL(pricingUrl).pathname)) continue;
    if (seen.has(host)) continue;

    const name = String(item?.name || item?.company || displayName(item?.title, host)).trim();
    if (!name || /^(best|top|compare|alternatives?\b)|\b(?:best|top)\s+\d+\b/i.test(name)) continue;
    seen.add(host);
    candidates.push({
      name: name.slice(0, 80),
      website: website ? new URL(website).origin : new URL(pricingUrl).origin,
      pricing_url: pricingUrl,
      notes: String(item?.notes || item?.reason || item?.snippet || 'Similar product found through web research')
        .trim().slice(0, 240),
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

export function fallbackCandidates(payload, productUrl = '', limit = 8) {
  return normalizeCandidates(searchHits(payload), productUrl, limit);
}
