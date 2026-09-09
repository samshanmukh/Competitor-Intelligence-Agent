import { normalizeCandidates } from '../../../lib/competitorDiscovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

function jsonError(message, status, code) {
  return Response.json({ error: message, code }, { status });
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* handled below */ }
    if (!response.ok) {
      const error = new Error(data?.error || data?.message || `Provider request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.', 400, 'BAD_REQUEST'); }

  const description = String(body?.description || '').trim().slice(0, 3000);
  const productUrl = String(body?.productUrl || '').trim().slice(0, 500);
  if (!description && !productUrl) {
    return jsonError('Add product details or a product URL first.', 400, 'BAD_REQUEST');
  }
  if (!process.env.YOUCOM_API_KEY) {
    return jsonError('You.com research is not configured.', 503, 'MISSING_KEY');
  }
  const isPhotoCaptionProduct = /photo[\s\S]{0,100}caption|caption[\s\S]{0,100}photo/i.test(description);
  const categoryClarifier = isPhotoCaptionProduct
    ? 'This product writes social-media post copy from photos. Caption means Instagram/social post text, not video subtitles or closed captions.'
    : '';
  try {
    const data = await fetchJson('https://api.you.com/v1/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.YOUCOM_API_KEY },
      body: JSON.stringify({
        input: `Research the closest direct product competitors to this product.\nProduct URL: ${productUrl || 'not provided'}\nProduct: ${description}\n${categoryClarifier}\nReturn only valid JSON as {"competitors":[{"name":"","website":"","pricing_url":"","notes":""}]}, with up to 8 close competitors. Use official company, pricing, App Store, or Google Play URLs. Exclude directories, articles, social networks, agencies, and the product itself.`,
        research_effort: 'lite',
      }),
    }, 42000);
    const parsed = parseJsonObject(data?.output?.content);
    const candidates = normalizeCandidates(parsed?.competitors || [], productUrl, 8);
    if (!candidates.length) {
      return jsonError('You.com did not return any verified direct competitors.', 502, 'EMPTY_RESEARCH');
    }
    return Response.json({ market: description, candidates, provider: 'youcom-research' });
  } catch (error) {
    return jsonError(
      error?.name === 'AbortError' ? 'You.com research timed out. Please try again.' : 'You.com research failed. Please try again.',
      error?.name === 'AbortError' ? 504 : 502,
      error?.name === 'AbortError' ? 'TIMEOUT' : 'YOUCOM_ERROR'
    );
  }
}
