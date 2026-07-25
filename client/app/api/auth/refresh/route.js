import { NextResponse } from 'next/server';
import { getInsforgeConfig } from '../../../../lib/insforgeServer';
import {
  REFRESH_COOKIE,
  applyAuthCookies,
  clearAuthCookies,
} from '../../../../lib/sessionCookies';

/** Clear the durable refresh session (used on sign-out). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 * Keeps the browser session alive for 24h+ without storing the refresh token in JS.
 */
export async function POST(request) {
  const cfg = getInsforgeConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const res = NextResponse.json({ error: 'No refresh session.', code: 'NO_REFRESH' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  try {
    const upstream = await fetch(`${cfg.baseUrl}/api/auth/refresh?client_type=mobile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    const text = await upstream.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Refresh failed (${upstream.status})` };
    }

    if (!upstream.ok || !data?.accessToken) {
      const res = NextResponse.json(
        { error: data.message || data.error || 'Session expired. Please sign in again.', code: 'REFRESH_FAILED' },
        { status: upstream.status === 401 || upstream.status === 403 ? 401 : 502 }
      );
      if (upstream.status === 401 || upstream.status === 403) clearAuthCookies(res);
      return res;
    }

    const res = NextResponse.json({
      accessToken: data.accessToken,
      user: data.user || null,
      expiresAt: data.expiresAt || null,
    });
    applyAuthCookies(res, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not renew session.' },
      { status: 502 }
    );
  }
}
