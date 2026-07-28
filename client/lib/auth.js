const TOKEN_KEY = 'cia_token';
const WORKSPACE_KEY = 'cia_workspace';
const RETURN_TO_KEY = 'cia_return_to';

/** Keep access token available for 24h in this browser (survives tab/browser close). */
const ACCESS_MAX_AGE = 60 * 60 * 24;
const WORKSPACE_MAX_AGE = 60 * 60 * 24 * 7;

// Match api.js: hit the backend directly in dev to bypass the Next proxy timeout.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let _refreshInflight = null;

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getWorkspace() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(WORKSPACE_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function cookieSecureFlag() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  // Readable cookie for Next.js middleware. Refresh token stays httpOnly server-side.
  document.cookie = `cia_auth=${token}; path=/; max-age=${ACCESS_MAX_AGE}; SameSite=Lax${cookieSecureFlag()}`;
}

function setWorkspace(ws) {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
  document.cookie = `cia_workspace_id=${ws.id}; path=/; max-age=${WORKSPACE_MAX_AGE}; SameSite=Lax${cookieSecureFlag()}`;
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  document.cookie = `cia_auth=; path=/; max-age=0${cookieSecureFlag()}`;
  document.cookie = `cia_workspace_id=; path=/; max-age=0${cookieSecureFlag()}`;
  // Best-effort clear of httpOnly refresh cookie via API (fire-and-forget).
  if (typeof window !== 'undefined') {
    fetch('/api/auth/refresh', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
  }
}

function tokenExpiresAt(token) {
  if (!token) return 0;
  try {
    const [, payload] = token.split('.');
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded));
    return decoded?.exp ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** True when access JWT is missing or within 2 minutes of expiry. */
export function accessTokenNeedsRefresh(token = getToken()) {
  if (!token) return true;
  const exp = tokenExpiresAt(token);
  if (!exp) return false; // opaque/dev tokens
  return exp - Date.now() < 2 * 60 * 1000;
}

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function ensureWorkspace(token) {
  // Same-origin Next proxy first (phone never needs to reach Render/InsForge directly).
  const paths = ['/api/auth/ensure-workspace'];
  if (API_BASE) paths.push(`${API_BASE}/api/auth/ensure-workspace`);
  for (const url of paths) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const { workspace } = await readJsonSafe(res);
      if (workspace) return workspace;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function authProxy(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const message = data.message || data.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

function applySession(data) {
  if (!data?.accessToken) return null;
  setToken(data.accessToken);
  return data.accessToken;
}

export async function signUp({ email, password, name }) {
  // Same-origin only, never call InsForge from the browser (Safari SSL / network blocks).
  let data;
  try {
    data = await authProxy('/api/auth/password/sign-up', { email, password, name });
  } catch (err) {
    throw new Error(friendlyAuthNetworkError(err));
  }

  if (data?.accessToken) {
    applySession(data);
    const ws = await ensureWorkspace(data.accessToken);
    if (ws) setWorkspace(ws);
  }
  return data;
}

export async function signIn({ email, password }) {
  // Same-origin only, never call InsForge from the browser (Safari SSL / network blocks).
  let data;
  try {
    data = await authProxy('/api/auth/password/sign-in', { email, password });
  } catch (err) {
    throw new Error(friendlyAuthNetworkError(err));
  }

  if (!data?.accessToken) throw new Error('No access token received');
  applySession(data);
  const ws = await ensureWorkspace(data.accessToken);
  if (ws) setWorkspace(ws);

  return { user: data.user, token: data.accessToken, workspace: ws };
}

export function safeReturnPath(value, fallback = '/app') {
  if (!value || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }
  return value;
}

export function rememberReturnPath(value) {
  if (typeof window === 'undefined') return;
  const path = safeReturnPath(value);
  if (path === '/app') sessionStorage.removeItem(RETURN_TO_KEY);
  else sessionStorage.setItem(RETURN_TO_KEY, path);
}

export function consumeReturnPath() {
  if (typeof window === 'undefined') return '/app';
  const path = safeReturnPath(sessionStorage.getItem(RETURN_TO_KEY));
  sessionStorage.removeItem(RETURN_TO_KEY);
  return path;
}

function friendlyAuthNetworkError(err) {
  const msg = err?.message || '';
  if (/Failed to fetch|NetworkError|Network request failed|Load failed/i.test(msg)) {
    return 'Could not reach the sign-in service. Check your connection and try again in a moment.';
  }
  return msg || 'Sign in failed';
}

export async function signInWithOAuth(provider, { from } = {}) {
  // First-party OAuth: browser only visits Google/GitHub + joinmira.ai (never InsForge).
  rememberReturnPath(from);
  const qs = new URLSearchParams();
  if (from) qs.set('from', safeReturnPath(from));
  window.location.href = `/api/auth/oauth/start/${encodeURIComponent(provider)}${qs.size ? `?${qs}` : ''}`;
}

// Deduplicate React Strict Mode double-mounts during the OAuth callback exchange.
let _oauthCompletion = null;

/**
 * Finish first-party OAuth on /auth/callback (session cookie set by our callback route).
 */
export async function completeOAuthCallback() {
  if (_oauthCompletion) return _oauthCompletion;

  _oauthCompletion = (async () => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error') || params.get('oauth_error');
    if (oauthError) {
      throw new Error(params.get('error_description') || oauthError);
    }

    // Clean sensitive query params from the address bar.
    if (params.has('via') || params.has('insforge_code') || params.has('error')) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('via');
      clean.searchParams.delete('insforge_code');
      clean.searchParams.delete('error');
      clean.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, clean.toString());
    }

    const res = await fetch('/api/auth/oauth/session', { credentials: 'same-origin' });
    const data = await readJsonSafe(res);
    if (!res.ok || !data?.accessToken) {
      throw new Error(data.error || 'Could not complete sign in. Please try email instead.');
    }

    setToken(data.accessToken);
    const workspace = await ensureWorkspace(data.accessToken);
    if (workspace) setWorkspace(workspace);

    return {
      user: data.user || null,
      token: data.accessToken,
      workspace,
      returnTo: data.returnTo || consumeReturnPath(),
    };
  })();

  try {
    return await _oauthCompletion;
  } catch (err) {
    _oauthCompletion = null;
    throw err;
  }
}

// Verify a 6-digit email code, store the resulting session, and bootstrap the workspace.
export async function verifyEmailCode({ email, otp }) {
  let data;
  try {
    data = await authProxy('/api/auth/password/verify', { email, otp });
  } catch (err) {
    throw new Error(friendlyAuthNetworkError(err));
  }
  if (!data?.accessToken) throw new Error('Verification did not return a session token');

  applySession(data);
  const ws = await ensureWorkspace(data.accessToken);
  if (ws) setWorkspace(ws);
  return { user: data.user, token: data.accessToken, workspace: ws };
}

export async function resendCode(email) {
  try {
    await authProxy('/api/auth/password/resend', { email });
  } catch (err) {
    throw new Error(friendlyAuthNetworkError(err));
  }
}

// True if the signed-in user's email is verified (best-effort).
export async function isEmailVerified() {
  const user = await getCurrentUser();
  return Boolean(user?.emailVerified);
}

export async function signOut() {
  // Clear local + httpOnly refresh cookie (server).
  clearAuth();
}

export async function getCurrentUser() {
  const token = await ensureFreshSession();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const data = await readJsonSafe(res);
    return data?.user || data || null;
  } catch {
    return null;
  }
}

/**
 * Renew access token using the httpOnly refresh cookie.
 * Safe across browser restarts for at least 24h (refresh cookie lives 7d).
 */
export async function refreshAccessToken() {
  if (_refreshInflight) return _refreshInflight;
  _refreshInflight = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await readJsonSafe(res);
      if (!res.ok || !data?.accessToken) return null;
      setToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      _refreshInflight = null;
    }
  })();
  return _refreshInflight;
}

/** Ensure we have a non-expired access token; refresh silently when needed. */
export async function ensureFreshSession() {
  const token = getToken();
  if (token && !accessTokenNeedsRefresh(token)) return token;
  const renewed = await refreshAccessToken();
  if (renewed) return renewed;
  // Refresh failed, keep existing token if it still looks valid (opaque/dev).
  if (token && tokenExpiresAt(token) > Date.now()) return token;
  if (token && !tokenExpiresAt(token)) return token;
  return null;
}

// Hard sign-out used when the session can't be recovered.
export function forceLogout() {
  // Localhost auth bypass, don't bounce to /login; re-bootstrap instead.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const bypassOn = process.env.NEXT_PUBLIC_AUTH_BYPASS === '1'
      || process.env.NEXT_PUBLIC_AUTH_BYPASS === 'true'
      || localStorage.getItem('cia_token') === 'dev-bypass';
    if (isLocal && bypassOn) {
      clearAuth();
      window.location.reload();
      return;
    }
  }
  clearAuth();
  if (typeof window !== 'undefined') {
    window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
  }
}

export async function fetchWorkspaces() {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(`${API_BASE}/api/auth/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const { workspaces } = await readJsonSafe(res);
  return workspaces || [];
}

export function switchWorkspace(ws) {
  setWorkspace(ws);
  window.location.reload();
}
