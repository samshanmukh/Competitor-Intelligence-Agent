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
  const name = String(body?.name || '').trim();
  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  return proxyInsforge('/api/auth/users', {
    method: 'POST',
    body: { email, password, ...(name ? { name } : {}) },
  });
}
