import { NextResponse } from 'next/server';
import { consumePendingSession } from '../../../../../lib/oauthServer';

export async function GET(request) {
  const clear = NextResponse.json({ error: 'No pending OAuth session.' }, { status: 404 });
  const session = consumePendingSession(request, clear);
  if (!session) return clear;

  const response = NextResponse.json(session);
  // Ensure the one-time session cookie is cleared on success too.
  response.cookies.set('mira_oauth_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
