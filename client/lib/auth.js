const TOKEN_KEY = 'cia_token';
const WORKSPACE_KEY = 'cia_workspace';
const RETURN_TO_KEY = 'cia_return_to';

// Match api.js: hit the backend directly in dev to bypass the Next proxy timeout.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getWorkspace() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(WORKSPACE_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  // Also set a non-httpOnly cookie for Next.js middleware to read.
  document.cookie = `cia_auth=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function setWorkspace(ws) {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
  document.cookie = `cia_workspace_id=${ws.id}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  document.cookie = 'cia_auth=; path=/; max-age=0';
  document.cookie = 'cia_workspace_id=; path=/; max-age=0';
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
  // Same-origin only — never call InsForge from the browser (Safari SSL / network blocks).
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
  // Same-origin only — never call InsForge from the browser (Safari SSL / network blocks).
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

const PKCE_VERIFIER_KEY = 'insforge_pkce_verifier';

function base64UrlEncode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkcePair() {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues || !cryptoObj.subtle) {
    throw new Error('This browser cannot start secure sign-in. Try Chrome, Safari, or Edge.');
  }
  const array = new Uint8Array(32);
  cryptoObj.getRandomValues(array);
  const verifier = base64UrlEncode(array);
  const hash = await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(hash) };
}

function friendlyAuthNetworkError(err) {
  const msg = err?.message || '';
  if (/Failed to fetch|NetworkError|Network request failed|Load failed/i.test(msg)) {
    return 'Could not reach the sign-in service. Check your connection and try again in a moment.';
  }
  return msg || 'Sign in failed';
}

export async function signInWithOAuth(provider, { from } = {}) {
  // OAuth still redirects through InsForge after Google/GitHub. On some mobile
  // networks Safari rejects InsForge's TLS cert ("Connection Is Not Private"),
  // so we keep this path proxy-only and never fall back to a direct InsForge call.
  rememberReturnPath(from);
  const redirectTo = new URL('/auth/callback', window.location.origin).toString();

  try {
    const { verifier, challenge } = await createPkcePair();
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    const qs = new URLSearchParams({
      redirect_uri: redirectTo,
      code_challenge: challenge,
    });
    const res = await fetch(`/api/auth/oauth/${encodeURIComponent(provider)}?${qs}`);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok || !data.authUrl) {
      throw new Error(data.error || `OAuth sign in failed (${res.status})`);
    }
    // Never send the browser to *.insforge.app — that surfaces Safari's SSL interstitial.
    const host = new URL(data.authUrl).hostname;
    if (/\.insforge\.app$/i.test(host) || host === 'insforge.app') {
      throw new Error('Google/GitHub sign-in is temporarily unavailable on this network. Please use email instead.');
    }
    window.location.href = data.authUrl;
  } catch (err) {
    throw new Error(friendlyAuthNetworkError(err));
  }
}

// Deduplicate React Strict Mode double-mounts during the OAuth callback exchange.
let _oauthCompletion = null;

/**
 * Finish the InsForge PKCE OAuth redirect on /auth/callback.
 * The SDK does not expose auth.getAccessToken(), so we exchange the code ourselves
 * and read the access token from the exchange response.
 */
export async function completeOAuthCallback() {
  if (_oauthCompletion) return _oauthCompletion;

  _oauthCompletion = (async () => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      throw new Error(params.get('error_description') || oauthError);
    }

    const code = params.get('insforge_code');
    if (code || oauthError) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('insforge_code');
      clean.searchParams.delete('error');
      clean.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, clean.toString());
    }

    if (!code) {
      throw new Error('Could not complete sign in. Please try email instead.');
    }

    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    const res = await fetch('/api/auth/oauth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data.error || 'OAuth code exchange failed');
    if (verifier) sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    const token = data?.accessToken || null;
    const user = data?.user || null;
    if (!token) throw new Error('No session token found after OAuth.');

    setToken(token);
    const workspace = await ensureWorkspace(token);
    if (workspace) setWorkspace(workspace);

    return {
      user,
      token,
      workspace,
      returnTo: consumeReturnPath(),
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
  // Local sign-out only — avoid browser calls to InsForge.
  clearAuth();
}

export async function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await readJsonSafe(res);
    return data?.user || data || null;
  } catch {
    return null;
  }
}

// Best-effort session check via same-origin proxy. Returns the current token or null.
export async function refreshAccessToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return token;
  } catch {
    return null;
  }
}

// Hard sign-out used when the session can't be recovered.
export function forceLogout() {
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
