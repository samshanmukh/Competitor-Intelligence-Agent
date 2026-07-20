import { proxyInsforge } from '../../../../../lib/insforgeServer';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim();
  const password = String(body?.password || '');
  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  return proxyInsforge('/api/auth/sessions', {
    method: 'POST',
    body: { email, password },
  });
}
