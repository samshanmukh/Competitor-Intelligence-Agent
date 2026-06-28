// Thin client for xAI's Grok via the OpenAI-compatible chat completions API.
// Used for (1) extracting structured competitors from research results and
// (2) analyzing pricing diffs.

function baseUrl() {
  return (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
}

function apiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    const err = new Error('XAI_API_KEY is not set. Add it to your .env file.');
    err.code = 'MISSING_KEY';
    throw err;
  }
  return key;
}

function model() {
  return process.env.XAI_MODEL || 'grok-4';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call Grok chat completions. Returns the assistant message string.
 * Retries on 429/5xx with exponential backoff.
 */
export async function complete({ system, user, temperature = 0.2, maxTokens = 1500, json = false }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const body = {
    model: model(),
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };

  const maxRetries = 3;
  let attempt = 0;
  while (true) {
    let res;
    try {
      res = await fetch(`${baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey()}`,
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      if (attempt < maxRetries) {
        await sleep(2 ** attempt * 1000);
        attempt++;
        continue;
      }
      const err = new Error(`Grok network error: ${networkErr.message}`);
      err.code = 'NETWORK';
      throw err;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      await sleep(2 ** attempt * 1000);
      attempt++;
      continue;
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(
        `Grok request failed (${res.status}): ${data?.error?.message || data?.error || text || res.statusText}`
      );
      err.code = res.status === 429 ? 'RATE_LIMITED' : 'API_ERROR';
      err.status = res.status;
      throw err;
    }

    return data?.choices?.[0]?.message?.content ?? '';
  }
}

/**
 * Call Grok and parse the response as JSON. Tolerates code fences / surrounding prose.
 */
export async function completeJSON(opts) {
  const raw = await complete({ ...opts, json: true });
  return parseJSONLoose(raw);
}

export function parseJSONLoose(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip ```json fences or grab the first {...} / [...] block.
    const fenced = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(fenced);
    } catch {
      const match = fenced.match(/[[{][\s\S]*[\]}]/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

export const grok = { complete, completeJSON };
