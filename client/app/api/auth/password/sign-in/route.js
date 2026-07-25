import { getInsforgeConfig } from '../../../../../lib/insforgeServer';
import { jsonWithSession } from '../../../../../lib/sessionCookies';
import { NextResponse } from 'next/server';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim();
  const password = String(body?.password || '');
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const cfg = getInsforgeConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
  }

  // client_type=mobile returns refreshToken in the body so we can store it httpOnly.
  try {
    const upstream = await fetch(`${cfg.baseUrl}/api/auth/sessions?client_type=mobile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const text = await upstream.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Auth service error (${upstream.status})` };
    }

    if (!upstream.ok) {
      const message = data.message || data.error || `Auth request failed (${upstream.status})`;
      return NextResponse.json(
        { error: message, message, ...data },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 }
      );
    }

    return jsonWithSession(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not reach authentication service.' },
      { status: 502 }
    );
  }
}
