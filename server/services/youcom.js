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

/**
 * Strip HTML to clean plain text suitable for diffing.
 */
function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(p|div|h[1-6]|li|tr|br|section|article|header|footer|nav|main|table|thead|tbody)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Contents API — fetch clean text for one or more URLs.
 * Returns a map of { url -> { markdown, error } }.
 * (field kept as `markdown` for backwards compat with callers)
 * @param {string|string[]} urls
 * @param {{ skipQueue?: boolean, timeoutMs?: number }} [opts]
 */
export async function fetchContents(urls, { skipQueue = false, timeoutMs = 120000 } = {}) {
  const list = Array.isArray(urls) ? urls : [urls];

  const map = {};
  for (const url of list) map[url] = { markdown: null, error: 'No content returned' };

  // 1) Try the You.com Contents API (don't let a failure block the Apify fallback).
  try {
    const json = await request('/contents', { urls: list }, { skipQueue, timeoutMs, retries: skipQueue ? 1 : MAX_RETRIES });
    const results = Array.isArray(json) ? json : json.results || json.contents || json.data || [];
    for (const item of results) {
      const url = item.url || item.source || item.link;
      if (!url) continue;
      const raw = item.html || item.markdown || item.content || item.text || item.body
        || (typeof item === 'string' ? item : null);
      if (raw) {
        const text = item.html ? htmlToText(raw) : raw;
        map[url] = text ? { markdown: text, error: null } : { markdown: null, error: 'Empty content after parsing' };
      } else {
        map[url] = { markdown: null, error: item.error || 'Empty content (site may block scrapers)' };
      }
    }
  } catch (err) {
    for (const url of list) if (!map[url].markdown) map[url] = { markdown: null, error: `You.com: ${err.message}` };
  }

  return map;
}

export const youcom = { research, fetchContents, webSearch, financeResearch, flattenYouPayload };
