// Thin client for the You.com Research + Contents APIs with simple
// rate-limit awareness (serialized calls + spacing + 429 retry/backoff).
//
// Response shapes as of 2026:
//   Research: POST /research { input } → { output: { content, content_type, sources:[{url,title,snippets}] } }
//   Contents: POST /contents { urls }  → [{url, html, title}]  (direct array, content is raw HTML)

import { getKey } from './keys.js';

const BASE = 'https://api.you.com/v1';

const MIN_INTERVAL_MS = Number(process.env.YOUCOM_MIN_INTERVAL_MS || 1200);
const MAX_RETRIES = Number(process.env.YOUCOM_MAX_RETRIES || 3);

let queue = Promise.resolve();
let lastCallAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function apiKey() {
  const key = getKey('YOUCOM_API_KEY');
  if (!key) {
    const err = new Error('YOUCOM_API_KEY is not set. Add it in Settings or your .env file.');
    err.code = 'MISSING_KEY';
    throw err;
  }
  return key;
}

function enqueue(fn) {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * @param {string} path
 * @param {object} body
 * @param {{ timeoutMs?: number, retries?: number, skipQueue?: boolean }} [opts]
 * skipQueue: for latency-sensitive demo paths — bypass MIN_INTERVAL spacing
 * (and the shared queue wait) for this call only. Authenticated heavy jobs
 * should keep the default (false).
 */
async function request(path, body, { timeoutMs = 120000, retries = MAX_RETRIES, skipQueue = false } = {}) {
  const key = apiKey();

  const run = async () => {
    let attempt = 0;
    while (true) {
      let res;
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        res = await fetch(`${BASE}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (networkErr) {
        clearTimeout(to);
        const aborted = networkErr?.name === 'AbortError';
        if (!aborted && attempt < retries) { await sleep(2 ** attempt * 1000); attempt++; continue; }
        const err = new Error(aborted
          ? `You.com ${path} timed out after ${Math.round(timeoutMs / 1000)}s`
          : `You.com network error: ${networkErr.message}`);
        err.code = aborted ? 'TIMEOUT' : 'NETWORK';
        throw err;
      } finally {
        clearTimeout(to);
      }

      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
        await sleep(backoff);
        attempt++;
        continue;
      }

      const text = await res.text();
      let json;
      try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

      if (!res.ok) {
        const err = new Error(
          `You.com ${path} failed (${res.status}): ${json?.error || json?.message || JSON.stringify(json) || res.statusText}`
        );
        err.code = res.status === 429 ? 'RATE_LIMITED' : 'API_ERROR';
        err.status = res.status;
        throw err;
      }

      return json;
    }
  };

  if (skipQueue) {
    try {
      return await run();
    } finally {
      lastCallAt = Date.now();
    }
  }

  return enqueue(run);
}

/**
 * Research API — used for competitor discovery.
 * Returns { output: { content, sources: [{url, title, snippets}] } }
 */
export async function research(query, { effort = 'standard' } = {}) {
  return request('/research', { input: query, research_effort: effort });
}

/**
 * Cheap web search (you-web) — faster than research / finance_research.
 * Tries POST /search; by default falls back to research() if search fails.
 * Pass noResearchFallback: true for latency-sensitive demo paths that must
 * never call research().
 * Returns a normalized { text, sources: [{title,url,snippet}] }.
 */
export async function webSearch(query, {
  count = 8,
  timeoutMs = 25000,
  skipQueue = false,
  noResearchFallback = false,
} = {}) {
  const q = String(query || '').trim();
  if (!q) return { text: '', sources: [] };

  try {
    const json = await request(
      '/search',
      { query: q, count },
      { timeoutMs, retries: 1, skipQueue }
    );
    const raw = json?.results;
    const hits = Array.isArray(raw)
      ? raw
      : [
          ...(Array.isArray(raw?.web) ? raw.web : []),
          ...(Array.isArray(raw?.news) ? raw.news : []),
          ...(Array.isArray(json?.hits) ? json.hits : []),
          ...(Array.isArray(json?.web_results) ? json.web_results : []),
        ];
    const sources = [];
    const parts = [];
    if (typeof json?.answer === 'string') parts.push(json.answer);
    for (const item of hits) {
      const title = item.title || item.name || '';
      const url = item.url || item.link || item.source_url || '';
      const snippet = item.snippet || item.description || item.content
        || (Array.isArray(item.snippets) ? item.snippets.join(' ') : '');
      if (url || title || snippet) {
        sources.push({ title, url, snippet });
        parts.push([title, url, snippet].filter(Boolean).join(' — '));
      }
    }
    const text = parts.join('\n').trim();
    if (text || sources.length) return { text, sources: sources.slice(0, count), engine: 'youcom-search' };
    if (noResearchFallback) return { text: '', sources: [], engine: 'youcom-search' };
  } catch (err) {
    if (noResearchFallback) {
      const empty = new Error(err?.message || 'webSearch failed');
      empty.code = err?.code || 'SEARCH_FAILED';
      throw empty;
    }
    /* fall through to research lite */
  }

  // Fallback: lite research (still cheaper than finance_research).
  const payload = await research(`Find recent web sources and concrete facts about: ${q}`, { effort: 'lite' });
  const sources = (payload?.output?.sources || []).slice(0, count).map((s) => ({
    title: s.title || '',
    url: s.url || '',
    snippet: Array.isArray(s.snippets) ? s.snippets.join(' ') : (s.snippet || ''),
  }));
  const text = [
    payload?.output?.content,
    ...sources.map((s) => [s.title, s.url, s.snippet].filter(Boolean).join(' — ')),
  ].filter(Boolean).join('\n');
  return { text, sources, engine: 'youcom-research' };
}

/** Flatten research/search-ish payloads into plain text for LLM prompts. */
export function flattenYouPayload(payload) {
  const parts = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) parts.push(v.trim()); };
  if (payload?.text) push(payload.text);
  if (payload?.output) {
    push(payload.output.content);
    for (const src of payload.output.sources || []) {
      push([src.title, src.url, (src.snippets || []).join(' ')].filter(Boolean).join(' — '));
    }
  }
  push(payload?.answer); push(payload?.summary);
  for (const src of payload?.sources || []) {
    push([src.title, src.url, src.snippet].filter(Boolean).join(' — '));
  }
  return parts.join('\n');
}

/**
 * Finance Research API — agentic financial/market research.
 * effort must be 'deep' or 'exhaustive'. Slow (1–3 min) but returns market
 * sizing, growth/CAGR, funding and revenue estimates with sources.
 * Returns { output: { content, sources: [...] } }.
 */
export async function financeResearch(input, effort = 'deep') {
  // Deep finance research can run several minutes; allow up to 6 and don't retry
  // (a retry would multiply an already-long, costly call).
  return request('/finance_research', { input, research_effort: effort }, { timeoutMs: 360000, retries: 0 });
}

const DIRECT_FETCH_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DIRECT_FETCH_TIMEOUT_MS = Number(process.env.YOUCOM_DIRECT_FETCH_TIMEOUT_MS || 15000);
const DIRECT_FETCH_CONCURRENCY = Number(process.env.YOUCOM_DIRECT_FETCH_CONCURRENCY || 3);
/** Body text shorter than this after You.com is treated as a failed SPA/shell scrape. */
const THIN_CONTENT_CHARS = 80;

function decodeEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/**
 * Pull title / description / Open Graph fields from HTML before body parsing.
 * Modern marketing SPAs often ship usable meta even when the crawler gets an empty shell.
 */
export function extractMetaText(html) {
  if (!html || typeof html !== 'string') return '';
  const metaContent = (key) => {
    const reNameFirst = new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      'i'
    );
    const reContentFirst = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["'][^>]*>`,
      'i'
    );
    const m = html.match(reNameFirst) || html.match(reContentFirst);
    return m ? decodeEntities(m[1]).trim() : '';
  };
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : '';
  const parts = [
    metaContent('og:title') || metaContent('twitter:title') || title,
    metaContent('og:description') || metaContent('twitter:description') || metaContent('description'),
    metaContent('og:site_name'),
  ].filter(Boolean);
  // Drop generic SPA shell titles that add no product signal.
  const useful = parts.filter((p) => !/^(app|home|index|website|untitled)$/i.test(p.trim()));
  return [...new Set(useful)].join('\n\n').trim();
}

/**
 * Strip HTML to clean plain text suitable for diffing / LLM context.
 * Falls back to meta description / og tags when the body is an empty SPA shell.
 */
export function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  const meta = extractMetaText(html);
  const body = html
    .replace(/<(script|style|noscript|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(p|div|h[1-6]|li|tr|br|section|article|header|footer|nav|main|table|thead|tbody)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (body && body.length >= THIN_CONTENT_CHARS) return body;
  if (meta && body) return `${meta}\n\n${body}`.trim();
  return meta || body;
}

function isThinText(text) {
  return !text || String(text).trim().length < THIN_CONTENT_CHARS;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Build readable markdown from You.com webSearch hits for a product/homepage URL.
 * Prefers same-host results (title + description/snippets) so SPA stubs still enrich.
 */
export function markdownFromSearchSources(url, sources = []) {
  const host = hostnameOf(url);
  const list = Array.isArray(sources) ? sources.filter((s) => s && (s.title || s.snippet || s.url)) : [];
  const ranked = [...list].sort((a, b) => {
    const score = (s) => {
      const u = String(s.url || '').toLowerCase();
      if (host && u.includes(host)) return 0;
      return 1;
    };
    return score(a) - score(b);
  });

  const parts = [];
  for (const s of ranked.slice(0, 6)) {
    const title = String(s.title || '').trim();
    const snippet = String(s.snippet || '').trim();
    const href = String(s.url || '').trim();
    const block = [title, snippet, href && title !== href ? href : '']
      .filter(Boolean)
      .join('\n');
    if (block) parts.push(block);
  }

  return parts.join('\n\n').trim();
}

/**
 * Cheap search about a URL/hostname when Contents + direct fetch return SPA stubs.
 * Uses /search only — never falls through to research().
 */
async function searchAboutUrl(url, {
  timeoutMs = 15000,
  skipQueue = false,
  count = 6,
} = {}) {
  const host = hostnameOf(url);
  const query = host
    ? `${url} OR site:${host}`
    : String(url || '').trim();
  if (!query) return { markdown: null, error: 'Empty search query' };

  try {
    const hit = await webSearch(query, {
      count,
      timeoutMs,
      skipQueue,
      noResearchFallback: true,
    });
    // Prefer structured title/snippet blocks; fall back to joined search text.
    const text = markdownFromSearchSources(url, hit.sources)
      || String(hit.text || '').trim();
    if (!isThinText(text)) {
      return { markdown: text, error: null, source: 'youcom-search' };
    }
    return { markdown: null, error: 'Web search returned no usable product details' };
  } catch (err) {
    return { markdown: null, error: err?.message || 'Web search failed' };
  }
}

/** True when Contents returned a bot/SPA stub (empty body, generic title). */
export function isStubHtml(html) {
  if (!html || typeof html !== 'string') return true;
  if (html.length < 400) return true;
  const withoutHead = html.replace(/<head[\s\S]*?<\/head>/i, '');
  const bodyInner = (withoutHead.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || withoutHead)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return bodyInner.length < 40;
}

function normalizeUrlKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    let href = u.href;
    if (href.endsWith('/') && u.pathname !== '/') href = href.slice(0, -1);
    return href.toLowerCase();
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

function resolveMapKey(map, url) {
  if (Object.prototype.hasOwnProperty.call(map, url)) return url;
  const want = normalizeUrlKey(url);
  for (const key of Object.keys(map)) {
    if (normalizeUrlKey(key) === want) return key;
  }
  return null;
}

function contentFromYouItem(item) {
  const html = typeof item?.html === 'string' ? item.html : null;
  const markdown = typeof item?.markdown === 'string' ? item.markdown : null;
  const other = item?.content || item?.text || item?.body
    || (typeof item === 'string' ? item : null);
  const rawHtml = html || (typeof other === 'string' && /<\/?[a-z][\s\S]*>/i.test(other) ? other : null);
  const rawText = markdown || (!rawHtml && typeof other === 'string' ? other : null);

  let text = '';
  if (rawHtml) text = htmlToText(rawHtml);
  else if (rawText) text = String(rawText).trim();

  // Title field from the API can still salvage a meta-less stub.
  if (isThinText(text) && item?.title && !/^(app|home|index|website|untitled)$/i.test(String(item.title).trim())) {
    text = [item.title, text].filter(Boolean).join('\n\n').trim();
  }

  const stub = rawHtml ? isStubHtml(rawHtml) : false;
  if (isThinText(text)) {
    return {
      markdown: null,
      error: stub
        ? 'Empty content after parsing (SPA shell or bot-blocked page)'
        : (item?.error || 'Empty content after parsing'),
      stub,
    };
  }
  return { markdown: text, error: null, stub: stub && isThinText(text) };
}

/**
 * Direct browser-UA HTML fetch for pages You.com Contents returns as empty SPA shells.
 * Only used as a fallback for thin/failed URLs — does not touch the You.com rate queue.
 */
async function directFetchHtml(url, { timeoutMs = DIRECT_FETCH_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': DIRECT_FETCH_UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      const err = new Error(`Direct fetch failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    const ctype = String(res.headers.get('content-type') || '');
    if (ctype && !/text\/html|application\/xhtml|\+xml/i.test(ctype) && !/text\/plain/i.test(ctype)) {
      throw new Error(`Direct fetch returned non-HTML (${ctype.split(';')[0]})`);
    }
    return await res.text();
  } finally {
    clearTimeout(to);
  }
}

async function mapPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
    }
  }));
  return out;
}

/**
 * Contents API — fetch clean text for one or more URLs.
 * Returns a map of { url -> { markdown, error, source? } }.
 * (field kept as `markdown` for backwards compat with callers)
 *
 * Resilience for modern marketing sites:
 *   1) You.com Contents
 *   2) Meta/og/title salvage from returned HTML
 *   3) Direct browser-UA HTML fetch when Contents returns an empty SPA shell
 *   4) You.com webSearch about the URL/hostname (title + snippets) — no research()
 *
 * @param {string|string[]} urls
 * @param {{ skipQueue?: boolean, timeoutMs?: number, allowDirectFetch?: boolean, allowSearchFallback?: boolean }} [opts]
 */
export async function fetchContents(urls, {
  skipQueue = false,
  timeoutMs = 120000,
  allowDirectFetch = true,
  allowSearchFallback = true,
} = {}) {
  const list = Array.isArray(urls) ? urls : [urls];

  const map = {};
  for (const url of list) map[url] = { markdown: null, error: 'No content returned' };

  // 1) You.com Contents API
  try {
    const json = await request(
      '/contents',
      { urls: list, formats: ['html', 'markdown', 'metadata'] },
      { skipQueue, timeoutMs, retries: skipQueue ? 1 : MAX_RETRIES }
    );
    const results = Array.isArray(json) ? json : json.results || json.contents || json.data || [];
    for (const item of results) {
      const returnedUrl = item.url || item.source || item.link;
      if (!returnedUrl) continue;
      const key = resolveMapKey(map, returnedUrl) || returnedUrl;
      if (!Object.prototype.hasOwnProperty.call(map, key) && list.length === 1) {
        // Single-URL call: always write onto the caller's key.
        const parsed = contentFromYouItem(item);
        map[list[0]] = {
          markdown: parsed.markdown,
          error: parsed.error,
          source: parsed.markdown ? 'youcom' : undefined,
        };
        continue;
      }
      const parsed = contentFromYouItem(item);
      map[key] = {
        markdown: parsed.markdown,
        error: parsed.error,
        source: parsed.markdown ? 'youcom' : undefined,
      };
    }
  } catch (err) {
    for (const url of list) {
      if (!map[url].markdown) map[url] = { markdown: null, error: `You.com: ${err.message}` };
    }
  }

  // 2) Direct fetch fallback for empty / SPA-shell results only.
  if (allowDirectFetch) {
    const needFallback = list.filter((url) => isThinText(map[url]?.markdown));
    if (needFallback.length) {
      await mapPool(needFallback, DIRECT_FETCH_CONCURRENCY, async (url) => {
        try {
          const html = await directFetchHtml(url);
          const text = htmlToText(html);
          if (!isThinText(text)) {
            map[url] = { markdown: text, error: null, source: 'direct' };
          } else if (!map[url].markdown) {
            map[url] = {
              markdown: null,
              error: map[url].error || 'Could not extract readable content from URL',
            };
          }
        } catch (err) {
          if (!map[url].markdown) {
            const prior = map[url].error && map[url].error !== 'No content returned'
              ? map[url].error
              : null;
            map[url] = {
              markdown: null,
              error: prior || `Could not read URL: ${err.message}`,
            };
          }
        }
      });
    }
  }

  // 3) WebSearch about URL/hostname when Contents + direct fetch are still thin.
  //    Search often has title/description for SPAs that return empty crawler shells.
  if (allowSearchFallback) {
    const needSearch = list.filter((url) => isThinText(map[url]?.markdown));
    if (needSearch.length) {
      const searchTimeout = Math.min(15000, Math.max(6000, timeoutMs));
      await mapPool(needSearch, Math.min(2, DIRECT_FETCH_CONCURRENCY), async (url) => {
        const prior = map[url]?.error;
        const found = await searchAboutUrl(url, {
          timeoutMs: searchTimeout,
          skipQueue,
          count: 6,
        });
        if (!isThinText(found.markdown)) {
          map[url] = {
            markdown: found.markdown,
            error: null,
            source: found.source || 'youcom-search',
          };
        } else if (!map[url].markdown) {
          map[url] = {
            markdown: null,
            error: prior || found.error || 'Could not extract readable content from URL',
          };
        }
      });
    }
  }

  return map;
}

export const youcom = {
  research,
  fetchContents,
  webSearch,
  financeResearch,
  flattenYouPayload,
  htmlToText,
  extractMetaText,
  isStubHtml,
  markdownFromSearchSources,
};
