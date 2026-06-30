// Apify integration — runs Actors synchronously and returns dataset items.
// Used for web-traffic data (SimilarWeb Actor) the You.com APIs don't provide.
import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const BASE = 'https://api.apify.com/v2';

function token() {
  return process.env.APIFY_TOKEN || '';
}

export function apifyConfigured() {
  return Boolean(token());
}

// Run an Actor and get its dataset items in one call. actorId uses the
// `username~actor-name` form (e.g. 'tri_angle~similarweb-scraper').
export async function runActorSync(actorId, input, { timeoutMs = 90000 } = {}) {
  if (!token()) {
    const err = new Error('APIFY_TOKEN is not set');
    err.code = 'NO_APIFY';
    throw err;
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token())}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: ctrl.signal }
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Apify ${actorId} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    try { return JSON.parse(text); } catch { return []; }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Apify ${actorId} timed out`);
    throw err;
  } finally {
    clearTimeout(to);
  }
}

// Scrape a single page's content (text/markdown) via Apify's first-party
// Website Content Crawler — handles JS rendering + anti-blocking + proxies,
// so it succeeds where the You.com Contents API gets blocked/returns empty.
export async function crawlContent(url, { maxPages = 1, timeoutMs = 150000 } = {}) {
  if (!token() || !url) return null;
  const items = await runActorSync(
    'apify~website-content-crawler',
    {
      startUrls: [{ url }],
      maxCrawlPages: maxPages,
      crawlerType: 'playwright:adaptive',
      saveMarkdown: true,
      proxyConfiguration: { useApifyProxy: true },
    },
    { timeoutMs }
  );
  if (!Array.isArray(items) || !items.length) return null;
  // Prefer the requested page; fall back to the first item with content.
  const it = items.find((x) => (x.markdown || x.text)) || items[0];
  return it?.markdown || it?.text || null;
}

function num(...vals) {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v.replace(/[, ]/g, '')); if (Number.isFinite(n)) return n; }
  }
  return null;
}

// Fetch website traffic for a domain.
//
// SimilarWeb (via CloudFront) returns 403 to every datacenter IP, and its
// heavyweight Apify Actors either hang for minutes or return empty. Instead we
// hit SimilarWeb's own lightweight JSON endpoint (the one its website calls)
// through Apify's RESIDENTIAL proxy — a single fast request that returns the
// full traffic profile. This requires a PAID Apify plan: residential proxies
// are gated (the free plan returns 403 on the proxy CONNECT), so on a free plan
// this fails fast and the UI explains that an upgrade is needed.
//
// Env:
//   APIFY_PROXY_GROUP    — proxy group (default RESIDENTIAL; '' disables proxy)
//   APIFY_PROXY_COUNTRY  — optional proxy exit country (e.g. US)
const SW_ENDPOINT = (d) => `https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(d)}`;

// The Apify proxy password differs from the API token; fetch + cache it.
let _proxyPwd = null;
async function apifyProxyPassword() {
  if (_proxyPwd) return _proxyPwd;
  const res = await fetch(`${BASE}/users/me?token=${encodeURIComponent(token())}`);
  if (!res.ok) throw new Error(`Apify account lookup failed (${res.status})`);
  const j = await res.json();
  _proxyPwd = j?.data?.proxy?.password;
  if (!_proxyPwd) throw new Error('No Apify proxy password on this account');
  return _proxyPwd;
}

// Build the Apify residential proxy URL (username encodes the group/country).
async function apifyProxyUrl() {
  const group = process.env.APIFY_PROXY_GROUP ?? 'RESIDENTIAL';
  const parts = [];
  if (group) parts.push(`groups-${group}`);
  if (process.env.APIFY_PROXY_COUNTRY) parts.push(`country-${process.env.APIFY_PROXY_COUNTRY}`);
  const user = parts.join(',') || 'auto';
  const pwd = await apifyProxyPassword();
  return `http://${user}:${encodeURIComponent(pwd)}@proxy.apify.com:8000`;
}

// GET JSON through the Apify proxy. Rejects with a tagged error on proxy/HTTP
// failure so callers can distinguish "blocked" (needs paid residential) cleanly.
function getJsonViaProxy(url, proxyUrl, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const agent = new HttpsProxyAgent(proxyUrl);
    const req = https.get(
      url,
      {
        agent,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'application/json',
          Referer: 'https://www.similarweb.com/',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (status !== 200) {
            const err = new Error(`SimilarWeb request blocked (HTTP ${status})`);
            err.code = status === 403 || status === 407 ? 'PROXY_BLOCKED' : 'HTTP_ERROR';
            return reject(err);
          }
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('SimilarWeb returned non-JSON')); }
        });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('SimilarWeb request timed out')); });
    req.on('error', (e) => {
      // Proxy CONNECT rejections (e.g. 403 on a free Apify plan) surface here.
      if (/40[37]/.test(e.message)) e.code = 'PROXY_BLOCKED';
      reject(e);
    });
  });
}

export async function getWebsiteTraffic(domain) {
  const clean = String(domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (!clean || !token()) return null;

  const proxyUrl = await apifyProxyUrl();
  const it = await getJsonViaProxy(SW_ENDPOINT(clean), proxyUrl, { timeoutMs: 30000 });
  if (!it || typeof it !== 'object') return null;

  // SimilarWeb JSON shape: EstimatedMonthlyVisits, Engagments, GlobalRank,
  // TrafficSources, TopCountryShares, Category.
  const history = it.EstimatedMonthlyVisits && typeof it.EstimatedMonthlyVisits === 'object'
    ? Object.entries(it.EstimatedMonthlyVisits)
        .map(([date, visits]) => ({ date, visits: num(visits) }))
        .filter((h) => h.visits != null)
    : [];

  const sources = it.TrafficSources && typeof it.TrafficSources === 'object'
    ? Object.entries(it.TrafficSources)
        .map(([channel, v]) => ({ channel, share: num(v) }))
        .filter((s) => s.share != null)
    : [];

  const topCountries = (Array.isArray(it.TopCountryShares) ? it.TopCountryShares : [])
    .map((c) => ({ country: c.CountryCode || c.Country, share: num(c.Value, c.value) }))
    .filter((c) => c.country && c.share != null)
    .slice(0, 6);

  return {
    domain: clean,
    total_visits: num(it.Engagments?.Visits, it.EstimatedMonthlyVisits && Object.values(it.EstimatedMonthlyVisits).slice(-1)[0]),
    global_rank: num(it.GlobalRank?.Rank),
    bounce_rate: num(it.Engagments?.BounceRate),
    pages_per_visit: num(it.Engagments?.PagePerVisit),
    avg_visit_duration: it.Engagments?.TimeOnSite || null,
    category: it.Category || null,
    history,
    sources,
    topCountries,
  };
}
