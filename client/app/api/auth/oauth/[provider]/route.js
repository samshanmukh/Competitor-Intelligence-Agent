// Same-origin OAuth start proxy. Browsers call joinmira.ai; we call InsForge server-side
// so corporate firewalls / extensions that block *.insforge.app don't break signup.
import { NextResponse } from 'next/server';

const PROVIDERS = new Set(['google', 'github']);

function insforgeConfig() {
  const baseUrl = process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const anonKey = process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return null;
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), anonKey };
}

export async function GET(request, context) {
  const params = await context.params;
  const provider = String(params?.provider || '').toLowerCase();
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'Unsupported OAuth provider.' }, { status: 400 });
  }

  const cfg = insforgeConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  if (!redirectUri || !codeChallenge) {
    return NextResponse.json({ error: 'redirect_uri and code_challenge are required.' }, { status: 400 });
  }

  // Only allow our own callback URLs (prevent open redirects via the proxy).
  try {
    const target = new URL(redirectUri);
    const host = request.headers.get('host') || '';
    const allowedHosts = new Set([
      host,
      host.replace(/^www\./, ''),
      `www.${host.replace(/^www\./, '')}`,
      'localhost:3000',
      'localhost:7001',
      'www.joinmira.ai',
      'joinmira.ai',
    ].filter(Boolean));
    if (!allowedHosts.has(target.host) || target.pathname !== '/auth/callback') {
      return NextResponse.json({ error: 'Invalid redirect_uri.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid redirect_uri.' }, { status: 400 });
  }

  const upstream = new URL(`${cfg.baseUrl}/api/auth/oauth/${provider}`);
  upstream.searchParams.set('redirect_uri', redirectUri);
  upstream.searchParams.set('code_challenge', codeChallenge);

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || 'Invalid response from auth provider.' }; }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || data.error || `OAuth start failed (${res.status})` },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }
    if (!data.authUrl) {
      return NextResponse.json({ error: 'Auth provider did not return a redirect URL.' }, { status: 502 });
    }
    return NextResponse.json({ authUrl: data.authUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not reach authentication service.' },
      { status: 502 }
    );
  }
}
