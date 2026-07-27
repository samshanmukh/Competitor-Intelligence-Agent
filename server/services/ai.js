// AI service using xAI's Grok via its OpenAI-compatible chat completions API.
// Keys are read from the in-memory cache (set via Settings UI or .env).

import OpenAI from 'openai';
import { getKey } from './keys.js';

function createClient() {
  const key = getKey('XAI_API_KEY');
  if (!key) {
    const err = new Error('XAI_API_KEY is not set. Add it in Settings or your .env file.');
    err.code = 'MISSING_KEY';
    throw err;
  }
  return new OpenAI({
    baseURL: (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, ''),
    apiKey: key,
  });
}

function model() {
  return getKey('XAI_MODEL') || 'grok-4';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function complete({
  system,
  user,
  messages: priorMessages,
  temperature = 0.2,
  maxTokens = 1500,
  json = false,
}) {
  const client = createClient();
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (Array.isArray(priorMessages) && priorMessages.length) {
    for (const m of priorMessages) {
      if (!m?.role || !m?.content) continue;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      messages.push({ role: m.role, content: String(m.content) });
    }
  } else if (user) {
    messages.push({ role: 'user', content: user });
  }
  if (!messages.some((m) => m.role === 'user')) {
    throw Object.assign(new Error('complete() requires a user message'), { code: 'BAD_REQUEST', status: 400 });
  }

  const params = {
    model: model(),
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) params.response_format = { type: 'json_object' };

  const maxRetries = 3;
  let attempt = 0;
  while (true) {
    try {
      const completion = await client.chat.completions.create(params);
      return completion.choices[0]?.message?.content ?? '';
    } catch (err) {
      if ((err.status === 429 || err.status >= 500) && attempt < maxRetries) {
        await sleep(2 ** attempt * 1000);
        attempt++;
        continue;
      }
      const wrapped = new Error(`Grok request failed: ${err.message}`);
      wrapped.code = err.status === 429 ? 'RATE_LIMITED' : 'API_ERROR';
      wrapped.status = err.status;
      throw wrapped;
    }
  }
}

export async function completeJSON(opts) {
  const raw = await complete({ ...opts, json: true });
  return parseJSONLoose(raw);
}

/**
 * Stream chat completion deltas. Yields string chunks.
 * Same message shape as complete().
 */
export async function* streamComplete({
  system,
  user,
  messages: priorMessages,
  temperature = 0.2,
  maxTokens = 1500,
}) {
  const client = createClient();
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (Array.isArray(priorMessages) && priorMessages.length) {
    for (const m of priorMessages) {
      if (!m?.role || !m?.content) continue;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      messages.push({ role: m.role, content: String(m.content) });
    }
  } else if (user) {
    messages.push({ role: 'user', content: user });
  }
  if (!messages.some((m) => m.role === 'user')) {
    throw Object.assign(new Error('streamComplete() requires a user message'), { code: 'BAD_REQUEST', status: 400 });
  }

  const stream = await client.chat.completions.create({
    model: model(),
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}


export function parseJSONLoose(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
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

export const ai = { complete, completeJSON, streamComplete };
