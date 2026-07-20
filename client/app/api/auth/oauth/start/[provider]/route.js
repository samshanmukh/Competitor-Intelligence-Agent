import { NextResponse } from 'next/server';
import {
  appOrigin,
  createStateCookie,
  providerConfig,
  redirectWithError,
} from '../../../../../lib/oauthServer';

const PROVIDERS = new Set(['google', 'github']);

function safeReturnTo(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/app';
  }
  return value;
}

export async function GET(request, context) {
  const params = await context.params;
  const provider = String(params?.provider || '').toLowerCase();
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 });
  }

  let origin;
  try {
    origin = appOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Could not determine app URL.' }, { status: 500 });
  }

  const cfg = providerConfig(provider);
  if (!cfg) {
    return redirectWithError(
      origin,
      `${provider === 'google' ? 'Google' : 'GitHub'} sign-in is not configured yet.`
    );
  }

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('from'));
  const redirectUri = `${origin}/api/auth/oauth/callback/${provider}`;

  // Build authorize URL first, then attach state cookie to the redirect response.
  const scratch = NextResponse.json({ ok: true });
  const state = createStateCookie(scratch, { provider, returnTo, origin });

  let authorizeUrl;
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('state', state.nonce);
    authorizeUrl = url.toString();
  } else {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state.nonce);
    authorizeUrl = url.toString();
  }

  const redirect = NextResponse.redirect(authorizeUrl);
  const stateCookie = scratch.cookies.get('mira_oauth_state');
  if (stateCookie?.value) {
    redirect.cookies.set('mira_oauth_state', stateCookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    });
  }
  return redirect;
}
