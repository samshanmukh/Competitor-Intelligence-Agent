// Same-origin proxy to the Express ensure-workspace endpoint (Render).
import { NextResponse } from 'next/server';

function apiBase() {
  return (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
}

export async function POST(request) {
  const base = apiBase();
  if (!base) {
    return NextResponse.json(
      { error: 'API backend is not configured (set API_BASE_URL or NEXT_PUBLIC_API_BASE).' },
      { status: 503 }
    );
  }

  const auth = request.headers.get('authorization') || '';
  if (!auth) {
    return NextResponse.json({ error: 'Missing authorization.' }, { status: 401 });
  }

  try {
    const res = await fetch(`${base}/api/auth/ensure-workspace`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `Backend error (${res.status})` }; }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not reach API backend.' },
      { status: 502 }
    );
  }
}
