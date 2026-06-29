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

async function request(path, body) {
  const key = apiKey();
  return enqueue(async () => {
    let attempt = 0;
    while (true) {
      let res;
      try {
        res = await fetch(`${BASE}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
          body: JSON.stringify(body),
        });
      } catch (networkErr) {
        if (attempt < MAX_RETRIES) { await sleep(2 ** attempt * 1000); attempt++; continue; }
        const err = new Error(`You.com network error: ${networkErr.message}`);
        err.code = 'NETWORK';
        throw err;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
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
  });
}

/**
 * Research API — used for competitor discovery.
 * Returns { output: { content, sources: [{url, title, snippets}] } }
 */
export async function research(query) {
  return request('/research', { input: query });
}

/**
 * Finance Research API — agentic financial/market research.
 * effort must be 'deep' or 'exhaustive'. Slow (1–3 min) but returns market
 * sizing, growth/CAGR, funding and revenue estimates with sources.
 * Returns { output: { content, sources: [...] } }.
 */
export async function financeResearch(input, effort = 'deep') {
  return request('/finance_research', { input, research_effort: effort });
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
 */
export async function fetchContents(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  const json = await request('/contents', { urls: list });

  // New format: direct array [{url, html, title}]
  // Legacy fallback: object with results/contents/data key
  const results = Array.isArray(json)
    ? json
    : json.results || json.contents || json.data || [];

  const map = {};
  for (const url of list) map[url] = { markdown: null, error: 'No content returned' };

  for (const item of results) {
    const url = item.url || item.source || item.link;
    if (!url) continue;

    // New: html field; legacy: markdown/content/text/body
    const raw = item.html || item.markdown || item.content || item.text || item.body
      || (typeof item === 'string' ? item : null);

    if (raw) {
      // Convert HTML to clean text; if already plain text this is a no-op effectively
      const text = item.html ? htmlToText(raw) : raw;
      map[url] = text
        ? { markdown: text, error: null }
        : { markdown: null, error: 'Empty content after parsing' };
    } else {
      map[url] = { markdown: null, error: item.error || 'Empty content (site may block scrapers)' };
    }
  }
  return map;
}

export const youcom = { research, fetchContents };
