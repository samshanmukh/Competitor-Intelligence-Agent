import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

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

/** All secrets ever used to derive OAuth bridge passwords (handles env drift). */
function passwordSecrets() {
  const list = [
    process.env.OAUTH_STATE_SECRET,
    process.env.FEATURE_REQUEST_SIGNING_SECRET,
    process.env.INSFORGE_ANON_KEY,
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  ].filter(Boolean);
  return [...new Set(list.filter((s) => s.length >= 16))];
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
    refreshToken: payload.refreshToken || null,
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
  // Admin API key (ik_…) can auto-confirm users; anon_… cannot.
  let apiKey = (process.env.INSFORGE_API_KEY || '').trim();
  if (apiKey.toLowerCase().startsWith('bearer ')) apiKey = apiKey.slice(7).trim();
  if (apiKey && !apiKey.startsWith('ik_')) {
    console.warn('[oauth] INSFORGE_API_KEY should start with ik_, got a different shape');
  }
  return { baseUrl, anonKey, apiKey };
}

async function insforgeFetch(path, { method = 'POST', body, useApiKey = false } = {}) {
  const { baseUrl, anonKey, apiKey } = insforgeConfig();
  const bearer = useApiKey && apiKey ? apiKey : anonKey;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

function oauthPasswords(provider, id) {
  const passwords = [];
  for (const secret of passwordSecrets()) {
    const digest = createHmac('sha256', secret).update(`${provider}:${id}`).digest('hex');
    // Prefer policy-friendly prefix (upper + digit + special); keep legacy forms.
    passwords.push(`Oa1.${digest}`);
    passwords.push(`Oa.${digest}`);
    if (provider === 'github') {
      passwords.push(`Gh.${createHmac('sha256', secret).update(`github:${id}`).digest('hex')}`);
    }
  }
  return [...new Set(passwords)];
}

function isAlreadyExistsError(err) {
  return err?.status === 409 || /already|exists|duplicate|registered/i.test(err?.message || '');
}

function isVerificationError(err) {
  return err?.status === 403 || /verif/i.test(err?.message || '');
}

async function signInWithPasswords(email, passwords) {
  let lastErr;
  for (const password of passwords) {
    try {
      // mobile → refreshToken in JSON body (we store it httpOnly on joinmira.ai)
      return await insforgeFetch('/api/auth/sessions?client_type=mobile', {
        body: { email, password },
      });
    } catch (err) {
      lastErr = err;
      // Wrong password, try next. Verification / other errors: keep trying passwords
      // in case an older bridge hash works and this one doesn't.
      if (isVerificationError(err) && !/invalid|credential|password|unauthorized/i.test(err.message || '')) {
        // Definitely verification-gated; no point trying other passwords for login.
        throw err;
      }
    }
  }
  throw lastErr || new Error('Sign in failed');
}

async function signInWithGoogleIdToken(idToken) {
  try {
    return await insforgeFetch('/api/auth/id-token?client_type=mobile', {
      body: { provider: 'google', token: idToken },
    });
  } catch {
    return insforgeFetch('/api/auth/id-token?client_type=server', {
      body: { provider: 'google', token: idToken },
    });
  }
}

async function findUserByEmail(email) {
  const { apiKey } = insforgeConfig();
  if (!apiKey) return null;
  try {
    const data = await insforgeFetch(
      `/api/auth/users?search=${encodeURIComponent(email)}&limit=20`,
      { method: 'GET', useApiKey: true }
    );
    const rows = data?.data || data?.users || [];
    return rows.find((u) => String(u.email || '').toLowerCase() === email) || null;
  } catch (err) {
    console.error('[oauth] list users failed', err.message);
    return null;
  }
}

async function deleteUsers(userIds) {
  if (!userIds?.length) return;
  await insforgeFetch('/api/auth/users', {
    method: 'DELETE',
    useApiKey: true,
    body: { userIds },
  });
}

async function markEmailVerified(email) {
  const { apiKey } = insforgeConfig();
  if (!apiKey) return false;
  try {
    await insforgeFetch('/api/database/advance/rawsql/unrestricted', {
      useApiKey: true,
      body: {
        query: 'UPDATE auth.users SET email_verified = true, updated_at = NOW() WHERE lower(email) = lower($1)',
        params: [email],
      },
    });
    return true;
  } catch (err) {
    console.error('[oauth] markEmailVerified failed', err.message);
    return false;
  }
}

/**
 * Link a verified Google/GitHub identity onto an existing InsForge email account
 * by setting the deterministic bridge password and marking email verified.
 * Safe only after the provider has proven email ownership.
 */
async function linkExistingAccountWithBridgePassword(email, password) {
  const { apiKey } = insforgeConfig();
  if (!apiKey) return false;

  const hash = await bcrypt.hash(password, 10);
  const attempts = [
    {
      query: `
        UPDATE auth.users
        SET password = $1, email_verified = true, updated_at = NOW()
        WHERE lower(email) = lower($2)
        RETURNING id
      `,
      params: [hash, email],
    },
    // Fallback if pgcrypto is available and bcryptjs hash is rejected.
    {
      query: `
        UPDATE auth.users
        SET password = crypt($1, gen_salt('bf')), email_verified = true, updated_at = NOW()
        WHERE lower(email) = lower($2)
        RETURNING id
      `,
      params: [password, email],
    },
  ];

  for (const body of attempts) {
    try {
      const result = await insforgeFetch('/api/database/advance/rawsql/unrestricted', {
        useApiKey: true,
        body,
      });
      const rows = result?.rows || result?.data || [];
      const count = result?.rowCount ?? rows.length;
      if (count > 0 || rows.length > 0) return true;
      console.error('[oauth] linkExistingAccount updated 0 rows', { email, result });
    } catch (err) {
      console.error('[oauth] linkExistingAccount failed', err.message, err.data);
    }
  }
  return false;
}

/** Existing email + verified social identity → set bridge password and sign in. */
async function loginExistingEmail(email, passwords) {
  const primaryPassword = passwords[0];
  if (!(await linkExistingAccountWithBridgePassword(email, primaryPassword))) {
    return null;
  }
  return signInWithPasswords(email, [primaryPassword, ...passwords.slice(1)]);
}

async function createBridgeUser({ email, password, name }) {
  const { apiKey } = insforgeConfig();
  const body = {
    email,
    password,
    name,
    ...(apiKey ? { autoConfirm: true } : {}),
  };
  return insforgeFetch('/api/auth/users?client_type=server', {
    body,
    useApiKey: Boolean(apiKey),
  });
}

/**
 * Bridge an external OAuth identity into InsForge via a deterministic server-only
 * password. Keeps the browser off *.insforge.app.
 *
 * Requires INSFORGE_API_KEY (ik_…) so new users can be auto-confirmed when the
 * project requires email verification. Without it, OAuth often creates an
 * unverified user and then cannot sign them in.
 */
export async function sessionFromOAuthProfile({ provider, id, email, name, idToken }) {
  if (!email) throw new Error(`${provider} account has no verified email.`);
  email = String(email).trim().toLowerCase();
  const passwords = oauthPasswords(provider, id);
  const primaryPassword = passwords[0];
  const displayName = name || email.split('@')[0];
  const { apiKey } = insforgeConfig();
  let lastDetail = '';

  // 1) Returning OAuth bridge user.
  try {
    return await signInWithPasswords(email, passwords);
  } catch (err) {
    lastDetail = err.message || 'sign-in failed';
    if (isVerificationError(err)) {
      // User exists with bridge password but email never verified (anon-key create).
      if (apiKey && await markEmailVerified(email)) {
        try {
          return await signInWithPasswords(email, passwords);
        } catch (err2) {
          lastDetail = err2.message || lastDetail;
        }
      }
    }
  }

  // 1b) Email likely already registered with a different password, link + log in silently.
  if (apiKey) {
    try {
      const linked = await loginExistingEmail(email, passwords);
      if (linked?.accessToken) return linked;
    } catch (err) {
      lastDetail = err.message || lastDetail;
      console.error('[oauth] early link+login failed', err.message);
    }
  }

  // 2) Google ID token (needs Google configured on InsForge with the same client ID).
  if (idToken) {
    try {
      return await signInWithGoogleIdToken(idToken);
    } catch (err) {
      lastDetail = err.message || lastDetail;
      console.error('[oauth] id-token failed', err.message);
    }
  }

  // 3) Create new bridge user (API key + autoConfirm when available).
  try {
    const created = await createBridgeUser({
      email,
      password: primaryPassword,
      name: displayName,
    });
    if (created?.accessToken) return created;
    // Admin autoConfirm path may return no token, sign in next.
    try {
      return await signInWithPasswords(email, [primaryPassword, ...passwords.slice(1)]);
    } catch (err) {
      lastDetail = err.message || lastDetail;
      if (isVerificationError(err) && apiKey && await markEmailVerified(email)) {
        return await signInWithPasswords(email, [primaryPassword, ...passwords.slice(1)]);
      }
    }
  } catch (err) {
    lastDetail = err.message || lastDetail;
    if (!isAlreadyExistsError(err)) {
      console.error('[oauth] create user failed', err.message);
      throw err;
    }

    // 4) Email already exists → silently link + log in (no user-facing "already exists").
    if (apiKey) {
      try {
        const session = await loginExistingEmail(email, passwords);
        if (session?.accessToken) return session;
      } catch (linkErr) {
        lastDetail = linkErr.message || lastDetail;
        console.error('[oauth] loginExistingEmail failed', linkErr.message);
      }

      // Last resort for stuck unverified orphans only.
      const existing = await findUserByEmail(email);
      const unverified = existing && (existing.emailVerified === false || existing.email_verified === false);
      if (unverified) {
        try {
          await deleteUsers([existing.id]);
          const created = await createBridgeUser({
            email,
            password: primaryPassword,
            name: displayName,
          });
          if (created?.accessToken) return created;
          return await signInWithPasswords(email, [primaryPassword]);
        } catch (recreateErr) {
          lastDetail = recreateErr.message || lastDetail;
          console.error('[oauth] recreate unverified user failed', recreateErr.message);
        }
      }
    }
  }

  console.error('[oauth] bridge exhausted', { provider, email, lastDetail, hasApiKey: Boolean(apiKey) });

  if (!apiKey) {
    throw new Error(
      'Social sign-in needs INSFORGE_API_KEY on the server (InsForge → API Keys → ik_…). Add it on Vercel and retry.'
    );
  }

  throw new Error('Social sign-in failed. Please try again in a moment.');
}

/** Prefer InsForge Google ID-token auth; fall back to email bridge. */
export async function sessionFromGoogleTokens({ idToken, accessToken }) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await res.json();
  if (!res.ok) throw new Error(profile.error?.message || 'Could not load Google profile');

  if (idToken) {
    try {
      return await signInWithGoogleIdToken(idToken);
    } catch (err) {
      console.error('[oauth] google id-token first pass failed', err.message);
    }
  }

  return sessionFromOAuthProfile({
    provider: 'google',
    id: profile.id,
    email: profile.email,
    name: profile.name,
    idToken,
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
