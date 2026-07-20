import { proxyInsforge } from '../../../../../lib/insforgeServer';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim();
  const otp = String(body?.otp || body?.code || '').trim();
  if (!email || !otp) {
    return Response.json({ error: 'Email and verification code are required.' }, { status: 400 });
  }

  return proxyInsforge('/api/auth/email/verify', {
    method: 'POST',
    body: { email, otp },
  });
}
