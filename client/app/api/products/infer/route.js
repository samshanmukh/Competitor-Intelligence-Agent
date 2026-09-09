import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { extractProductMetadata } from '../../../../lib/productMetadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1_500_000;

function isPrivateAddress(address) {
  if (address === '::1' || address === '0:0:0:0:0:0:0:1') return true;
  if (address.includes(':')) {
    const value = address.toLowerCase();
    return value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9')
      || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('::ffff:127.')
      || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.');
  }

  const parts = address.split('.').map(Number);
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

async function safeUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('Enter a valid public website URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Enter a valid public website URL.');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new Error('Private network URLs are not supported.');
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private network URLs are not supported.');
  }
  return url;
}

async function fetchPublicHtml(input) {
  let url = await safeUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; MiraBot/1.0; +https://www.joinmira.ai)',
        },
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('The website redirected too many times.');
      url = await safeUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The website returned ${response.status}.`);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('That URL did not return a web page.');
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (declaredLength > MAX_HTML_BYTES) throw new Error('That page is too large to inspect.');
    const html = await response.text();
    if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new Error('That page is too large to inspect.');
    return { html, url: url.toString() };
  }
  throw new Error('Could not read that website.');
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const { html, url } = await fetchPublicHtml(body?.url);
    const product = extractProductMetadata(html, url);
    if (!product.name && !product.description) {
      return NextResponse.json({ error: 'Could not find company information on that page.' }, { status: 422 });
    }
    return NextResponse.json(product);
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'The website took too long to respond.'
      : error?.message || 'Could not read that website.';
    const status = /valid|Private network/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
