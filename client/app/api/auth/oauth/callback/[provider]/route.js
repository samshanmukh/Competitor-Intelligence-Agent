import { NextResponse } from 'next/server';
import {
  appOrigin,
  clearStateCookie,
  createPendingSessionCookie,
  exchangeGitHubCode,
  exchangeGoogleCode,
  providerConfig,
  readStateCookie,
  redirectWithError,
  sessionFromGoogleTokens,
  sessionFromOAuthProfile,
} from '../../../../../../lib/oauthServer';

export const runtime = 'nodejs';

const PROVIDERS = new Set(['google', 'github']);

export async function GET(request, context) {
  const params = await context.params;
  const provider = String(params?.provider || '').toLowerCase();
  const origin = appOrigin(request);

  if (!PROVIDERS.has(provider)) {
    return redirectWithError(origin, 'Unsupported sign-in provider.');
  }

  const url = request.nextUrl;
  const error = url.searchParams.get('error');
  if (error) {
    return redirectWithError(origin, url.searchParams.get('error_description') || error);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = readStateCookie(request);
  if (!code || !state || !saved || saved.provider !== provider || saved.nonce !== state) {
    return redirectWithError(origin, 'Sign-in session expired. Please try again.');
  }

  const cfg = providerConfig(provider);
  if (!cfg) {
    return redirectWithError(origin, 'OAuth is not configured.');
  }

  const redirectUri = `${origin}/api/auth/oauth/callback/${provider}`;

  try {
    let session;
    if (provider === 'google') {
      const tokens = await exchangeGoogleCode(code, redirectUri, cfg.clientId, cfg.clientSecret);
      session = await sessionFromGoogleTokens({
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
      });
    } else {
      const profile = await exchangeGitHubCode(code, redirectUri, cfg.clientId, cfg.clientSecret);
      session = await sessionFromOAuthProfile({
        provider: 'github',
        id: profile.id,
        email: profile.email,
        name: profile.name,
      });
    }

    if (!session?.accessToken) {
      return redirectWithError(origin, 'Could not create a session. Please try email sign-in.');
    }

    const dest = new URL('/auth/callback', origin);
    dest.searchParams.set('via', 'mira');
    const response = NextResponse.redirect(dest);
    clearStateCookie(response);
    createPendingSessionCookie(response, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken || null,
      user: session.user || null,
      returnTo: saved.returnTo || '/app',
    });
    return response;
  } catch (err) {
    const response = redirectWithError(origin, err.message || 'OAuth sign-in failed.');
    clearStateCookie(response);
    return response;
  }
}
