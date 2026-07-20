// Same-origin PKCE code exchange proxy (browser → Next → InsForge).
import { NextResponse } from 'next/server';

function insforgeConfig() {
  const baseUrl = process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const anonKey = process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return null;
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), anonKey };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const code = String(body?.code || '').trim();
  const codeVerifier = String(body?.code_verifier || '').trim();
  if (!code || !codeVerifier) {
    return NextResponse.json({ error: 'code and code_verifier are required.' }, { status: 400 });
  }

  const cfg = insforgeConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/api/auth/oauth/exchange`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
      cache: 'no-store',
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || 'Invalid response from auth provider.' }; }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || data.error || `OAuth exchange failed (${res.status})` },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not reach authentication service.' },
      { status: 502 }
    );
  }
}
