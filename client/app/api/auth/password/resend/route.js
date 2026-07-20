import { proxyInsforge } from '../../../../../lib/insforgeServer';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim();
  if (!email) {
    return Response.json({ error: 'Email is required.' }, { status: 400 });
  }

  return proxyInsforge('/api/auth/email/send-verification', {
    method: 'POST',
    body: { email },
  });
}
