import { NextResponse } from 'next/server';
import { authBypassActiveForHost, DEV_BYPASS_TOKEN } from '../../../../lib/authBypass';

function apiBase() {
  return (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000').replace(/\/$/, '');
}

/**
 * Bootstrap a localhost-only session when AUTH_BYPASS is enabled.
 * Creates/returns a workspace for the fixed local-dev user via the Express API.
 */
export async function GET(request) {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];
  if (!authBypassActiveForHost(hostname)) {
    return NextResponse.json({ error: 'Auth bypass is not available.' }, { status: 404 });
  }

  const base = apiBase();
  const headers = {
    Authorization: `Bearer ${DEV_BYPASS_TOKEN}`,
    Accept: 'application/json',
  };

  try {
    const ensureRes = await fetch(`${base}/api/auth/ensure-workspace`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    });
    const ensureText = await ensureRes.text();
    let ensureData = {};
    try { ensureData = ensureText ? JSON.parse(ensureText) : {}; } catch { ensureData = {}; }

    if (!ensureRes.ok) {
      return NextResponse.json(
        { error: ensureData.error || 'Could not create local workspace.' },
        { status: ensureRes.status }
      );
    }

    const meRes = await fetch(`${base}/api/auth/me`, {
      headers,
      cache: 'no-store',
    });
    const meText = await meRes.text();
    let meData = {};
    try { meData = meText ? JSON.parse(meText) : {}; } catch { meData = {}; }

    const workspace = ensureData.workspace || meData.workspaces?.[0] || null;
    const user = meData.user || { id: 'local-dev-user', email: 'dev@localhost' };

    const response = NextResponse.json({
      token: DEV_BYPASS_TOKEN,
      user,
      workspace,
      bypass: true,
    });
    response.cookies.set('cia_auth', DEV_BYPASS_TOKEN, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    if (workspace?.id) {
      response.cookies.set('cia_workspace_id', String(workspace.id), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not reach local API. Is the server running on :4000?' },
      { status: 502 }
    );
  }
}
