// Same-origin proxy for the current InsForge user (avoids browser → InsForge).

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth) {
    return Response.json({ error: 'Missing authorization.' }, { status: 401 });
  }

  // proxyInsforge always sends the anon key; forward the user bearer instead.
  const cfgBase = (process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '').replace(/\/$/, '');
  if (!cfgBase) {
    return Response.json({ error: 'Authentication is not configured.' }, { status: 503 });
  }

  try {
    const res = await fetch(`${cfgBase}/api/auth/sessions/current`, {
      headers: {
        Authorization: auth,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `Auth error (${res.status})` }; }
    if (!res.ok) {
      return Response.json(
        { error: data.message || data.error || `Auth request failed (${res.status})` },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message || 'Could not reach authentication service.' }, { status: 502 });
  }
}
