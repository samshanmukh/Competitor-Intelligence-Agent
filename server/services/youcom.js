// Thin client for the You.com Research + Contents APIs with simple
// rate-limit awareness (serialized calls + spacing + 429 retry/backoff).

const BASE = 'https://api.you.com/v1';

// You.com plans are rate limited; we keep calls polite by serializing them
// and spacing requests. Tune via env if you have a higher quota.
const MIN_INTERVAL_MS = Number(process.env.YOUCOM_MIN_INTERVAL_MS || 1200);
const MAX_RETRIES = Number(process.env.YOUCOM_MAX_RETRIES || 3);

let queue = Promise.resolve();
let lastCallAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function apiKey() {
  const key = process.env.YOUCOM_API_KEY;
  if (!key) {
    const err = new Error('YOUCOM_API_KEY is not set. Add it to your .env file.');
    err.code = 'MISSING_KEY';
    throw err;
  }
  return key;
}

// Run `fn` on a global serialized queue so we never exceed the rate limit by
// firing concurrent requests. Each task also respects MIN_INTERVAL_MS spacing.
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
  // Keep the chain alive even if a task rejects.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function request(path, body) {
  // Validate the key up front so a missing key surfaces as MISSING_KEY (HTTP 400)
  // rather than being rewrapped as a network error inside the retry loop.
  const key = apiKey();
  return enqueue(async () => {
    let attempt = 0;
    // Retry on 429 / 5xx with exponential backoff.
    while (true) {
      let res;
      try {
        res = await fetch(`${BASE}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': key,
          },
          body: JSON.stringify(body),
        });
      } catch (networkErr) {
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 1000);
          attempt++;
          continue;
        }
        const err = new Error(`You.com network error: ${networkErr.message}`);
        err.code = 'NETWORK';
        throw err;
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get('retry-after'));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2 ** attempt * 1000;
          await sleep(backoff);
          attempt++;
          continue;
        }
      }

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        const err = new Error(
          `You.com ${path} failed (${res.status}): ${json?.error || json?.message || text || res.statusText}`
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
 * Returns the raw research payload; the discovery agent extracts structure from it.
 */
export async function research(query) {
  return request('/research', { query });
}

/**
 * Contents API — fetch clean Markdown for one or more URLs.
 * Returns a map of { url -> { markdown, error } }.
 */
export async function fetchContents(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  const json = await request('/contents', { urls: list });

  // The Contents API returns an array of result objects. Normalize defensively
  // since field names can vary across API versions.
  const results = json.results || json.contents || json.data || [];
  const map = {};
  for (const url of list) map[url] = { markdown: null, error: 'No content returned' };

  for (const item of Array.isArray(results) ? results : []) {
    const url = item.url || item.source || item.link;
    const markdown =
      item.markdown || item.content || item.text || item.body || (typeof item === 'string' ? item : null);
    if (url) {
      map[url] = markdown
        ? { markdown, error: null }
        : { markdown: null, error: item.error || 'Empty content (site may block scrapers)' };
    }
  }
  return map;
}

export const youcom = { research, fetchContents };
