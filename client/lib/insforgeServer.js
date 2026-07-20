// Server-side helpers for proxying InsForge auth from Next.js route handlers.
import { NextResponse } from 'next/server';

export function getInsforgeConfig() {
  const baseUrl = (process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) return null;
  return { baseUrl, anonKey };
}

export async function proxyInsforge(path, { method = 'GET', body, searchParams } = {}) {
  const cfg = getInsforgeConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
  }

  const url = new URL(`${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Auth service error (${res.status})` };
    }

    if (!res.ok) {
      const message = data.message || data.error || `Auth request failed (${res.status})`;
      return NextResponse.json({ error: message, ...data, message }, {
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not reach authentication service.' },
      { status: 502 }
    );
  }
}
