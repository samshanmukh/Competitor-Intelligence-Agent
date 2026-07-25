import { NextResponse } from 'next/server';
import { consumePendingSession } from '../../../../../lib/oauthServer';
import { applyAuthCookies } from '../../../../../lib/sessionCookies';

export async function GET(request) {
  const clear = NextResponse.json({ error: 'No pending OAuth session.' }, { status: 404 });
  const session = consumePendingSession(request, clear);
  if (!session) return clear;

  const response = NextResponse.json({
    accessToken: session.accessToken,
    user: session.user || null,
    returnTo: session.returnTo || '/app',
  });
  // Clear one-time OAuth bridge cookie and plant durable session cookies.
  response.cookies.set('mira_oauth_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  applyAuthCookies(response, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken || null,
  });
  return response;
}
