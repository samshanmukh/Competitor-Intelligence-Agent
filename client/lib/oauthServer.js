import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

const STATE_COOKIE = 'mira_oauth_state';
const SESSION_COOKIE = 'mira_oauth_session';
const STATE_MAX_AGE = 60 * 10; // 10 minutes
const SESSION_MAX_AGE = 60 * 2; // 2 minutes

function signingSecret() {
  const secret = process.env.OAUTH_STATE_SECRET
    || process.env.FEATURE_REQUEST_SIGNING_SECRET
    || process.env.INSFORGE_ANON_KEY;
  if (!secret || secret.length < 16) {
    throw new Error('Set OAUTH_STATE_SECRET (or FEATURE_REQUEST_SIGNING_SECRET) for OAuth.');
  }
  return secret;
}

export function appOrigin(request) {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (!host) throw new Error('Could not determine app URL.');
  return `${proto}://${host}`;
}

export function providerConfig(provider) {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, provider };
  }
  if (provider === 'github') {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, provider };
  }
  return null;
}

function sign(value) {
  return createHmac('sha256', signingSecret()).update(value).digest('hex');
}

function encodePayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodePayload(raw) {
  if (!raw || !raw.includes('.')) return null;
  const [body, signature] = raw.split('.');
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function createStateCookie(response, { provider, returnTo, origin }) {
  const nonce = randomBytes(16).toString('hex');
  const payload = {
    nonce,
    provider,
    returnTo: returnTo || '/app',
    origin,
    exp: Date.now() + STATE_MAX_AGE * 1000,
  };
  response.cookies.set(STATE_COOKIE, encodePayload(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE,
  });
  return payload;
}

export function readStateCookie(request) {
  const raw = request.cookies.get(STATE_COOKIE)?.value;
  const payload = decodePayload(raw);
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

export function clearStateCookie(response) {
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function createPendingSessionCookie(response, session) {
  response.cookies.set(SESSION_COOKIE, encodePayload({
    ...session,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function consumePendingSession(request, response) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  const payload = decodePayload(raw);
  if (!payload || !payload.exp || payload.exp < Date.now() || !payload.accessToken) return null;
  return {
    accessToken: payload.accessToken,
    user: payload.user || null,
    returnTo: payload.returnTo || '/app',
  };
}

export function redirectWithError(origin, message) {
  const url = new URL('/login', origin);
  url.searchParams.set('oauth_error', message);
  return NextResponse.redirect(url);
}

function insforgeConfig() {
  const baseUrl = (process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error('InsForge is not configured.');
  return { baseUrl, anonKey };
}

async function insforgeFetch(path, { method = 'POST', body } = {}) {
  const { baseUrl, anonKey } = insforgeConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) {
    const err = new Error(data.message || data.error || `InsForge auth failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Bridge an external OAuth identity into InsForge via a deterministic server-only
 * password. Keeps the browser off *.insforge.app and works for Google + GitHub.
 */
export async function sessionFromOAuthProfile({ provider, id, email, name }) {
  if (!email) throw new Error(`${provider} account has no verified email.`);
  const secret = signingSecret();
  const password = `Oa.${createHmac('sha256', secret).update(`${provider}:${id}`).digest('hex')}`;

  try {
    return await insforgeFetch('/api/auth/sessions', { body: { email, password } });
  } catch {
    /* create below */
  }

  try {
    const created = await insforgeFetch('/api/auth/users', {
      body: {
        email,
        password,
        name: name || email.split('@')[0],
      },
    });
    if (created?.accessToken) return created;
  } catch (err) {
    if (/already|exists|duplicate|registered/i.test(err.message || '')) {
      throw new Error('An account with this email already exists. Sign in with email and password instead.');
    }
    throw err;
  }

  return insforgeFetch('/api/auth/sessions', { body: { email, password } });
}

/** Prefer InsForge Google ID-token auth; fall back to email bridge. */
export async function sessionFromGoogleTokens({ idToken, accessToken }) {
  if (idToken) {
    try {
      return await insforgeFetch('/api/auth/id-token?client_type=mobile', {
        body: { provider: 'google', token: idToken },
      });
    } catch {
      /* audience mismatch or unsupported — use profile bridge */
    }
  }

  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await res.json();
  if (!res.ok) throw new Error(profile.error?.message || 'Could not load Google profile');
  return sessionFromOAuthProfile({
    provider: 'google',
    id: profile.id,
    email: profile.email,
    name: profile.name,
  });
}

export async function exchangeGoogleCode(code, redirectUri, clientId, clientSecret) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Google token exchange failed');
  }
  return data;
}

export async function exchangeGitHubCode(code, redirectUri, clientId, clientSecret) {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'GitHub token exchange failed');
  }

  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Mira-AI',
  };
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers }),
    fetch('https://api.github.com/user/emails', { headers }),
  ]);
  const user = await userRes.json();
  const emails = emailsRes.ok ? await emailsRes.json() : [];
  if (!userRes.ok) throw new Error(user.message || 'Could not load GitHub profile');

  const primary = (Array.isArray(emails) ? emails : []).find((e) => e.primary && e.verified)
    || (Array.isArray(emails) ? emails : []).find((e) => e.verified);
  const email = primary?.email || user.email;
  return {
    id: user.id,
    email,
    name: user.name || user.login,
  };
}
