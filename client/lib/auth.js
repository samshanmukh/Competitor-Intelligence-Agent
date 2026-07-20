import { createClient } from '@insforge/sdk';

let _client = null;
function getClient() {
  if (!_client) {
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
    if (!baseUrl || !anonKey) {
      throw new Error('Authentication is not configured. Contact the workspace administrator.');
    }
    _client = createClient({ baseUrl, anonKey });
  }
  return _client;
}

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
  const res = await fetch(`${API_BASE}/api/auth/ensure-workspace`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const { workspace } = await readJsonSafe(res);
  return workspace || null;
}

export async function signUp({ email, password, name }) {
  const { data, error } = await getClient().auth.signUp({ email, password, name });
  if (error) throw new Error(error.message || 'Sign up failed');
  // If verification is disabled, Insforge returns a session immediately — store it
  // and bootstrap the workspace so the user can go straight into the app.
  if (data?.accessToken) {
    setToken(data.accessToken);
    const ws = await ensureWorkspace(data.accessToken);
    if (ws) setWorkspace(ws);
  }
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message || 'Sign in failed');
  if (!data?.accessToken) throw new Error('No access token received');

  setToken(data.accessToken);
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
    return 'Could not reach the sign-in service. Check your connection, disable ad blockers for this site, then try again — or use email signup.';
  }
  return msg || 'OAuth sign in failed';
}

export async function signInWithOAuth(provider, { from } = {}) {
  // Keep redirectTo path-stable for InsForge allowlists; return path lives in sessionStorage.
  rememberReturnPath(from);
  const redirectTo = new URL('/auth/callback', window.location.origin).toString();

  // Prefer same-origin proxy so browsers that block *.insforge.app still work.
  let authUrl = null;
  let proxyError = null;
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
    if (res.ok && data.authUrl) authUrl = data.authUrl;
    else proxyError = new Error(data.error || `OAuth sign in failed (${res.status})`);
  } catch (err) {
    proxyError = err;
  }

  if (!authUrl) {
    // Fall back to direct InsForge SDK call when the proxy path fails.
    try {
      const { error } = await getClient().auth.signInWithOAuth(provider, { redirectTo });
      if (error) throw new Error(error.message || 'OAuth sign in failed');
      return;
    } catch (directErr) {
      throw new Error(friendlyAuthNetworkError(proxyError || directErr));
    }
  }

  window.location.href = authUrl;
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
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
    if (!baseUrl || !anonKey) {
      throw new Error('Authentication is not configured. Contact the workspace administrator.');
    }

    // Disable auto-detection so we control the exchange and can capture accessToken.
    const client = createClient({
      baseUrl,
      anonKey,
      auth: { detectOAuthCallback: false },
    });

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      throw new Error(params.get('error_description') || oauthError);
    }

    const code = params.get('insforge_code');
    // Drop sensitive query params from the address bar as soon as we've read them.
    if (code || oauthError) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('insforge_code');
      clean.searchParams.delete('error');
      clean.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, clean.toString());
    }

    let token = null;
    let user = null;

    if (code) {
      const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
      // Prefer same-origin exchange proxy (avoids browser → InsForge fetch failures).
      try {
        const res = await fetch('/api/auth/oauth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, code_verifier: verifier }),
        });
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
        if (!res.ok) throw new Error(data.error || 'OAuth code exchange failed');
        if (verifier) sessionStorage.removeItem(PKCE_VERIFIER_KEY);
        token = data?.accessToken || null;
        user = data?.user || null;
        if (token) client.setAccessToken(token);
      } catch (proxyErr) {
        const { data, error } = await client.auth.exchangeOAuthCode(code);
        if (error) throw new Error(error.message || proxyErr.message || 'OAuth code exchange failed');
        token = data?.accessToken || null;
        user = data?.user || null;
      }
    } else {
      const { data, error } = await client.auth.getCurrentUser();
      if (error || !data?.user) {
        throw new Error('Could not complete sign in. Please try again.');
      }
      user = data.user;
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error) throw new Error(refreshed.error.message || 'Could not refresh session');
      token = refreshed.data?.accessToken || null;
    }

    if (!token) throw new Error('No session token found after OAuth.');

    setToken(token);
    client.setAccessToken(token);
    _client = client;

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
  const { data, error } = await getClient().auth.verifyEmail({ email, otp });
  if (error) throw new Error(error.message || 'Invalid or expired code');
  if (!data?.accessToken) throw new Error('Verification did not return a session token');

  setToken(data.accessToken);
  const ws = await ensureWorkspace(data.accessToken);
  if (ws) setWorkspace(ws);
  return { user: data.user, token: data.accessToken, workspace: ws };
}

export async function resendCode(email) {
  const { error } = await getClient().auth.resendVerificationEmail({ email });
  if (error) throw new Error(error.message || 'Could not resend code');
}

// True if the signed-in user's email is verified (best-effort).
export async function isEmailVerified() {
  const user = await getCurrentUser();
  return Boolean(user?.emailVerified);
}

export async function signOut() {
  await getClient().auth.signOut().catch(() => {});
  clearAuth();
}

export async function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const { data, error } = await getClient().auth.getCurrentUser();
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Attempt to silently obtain a fresh access token using the Insforge SDK's
// refresh mechanism (httpOnly refresh cookie). Returns the new token or null.
export async function refreshAccessToken() {
  try {
    const client = getClient();
    const { data, error } = await client.auth.getCurrentUser();
    if (error || !data?.user) return null;
    const token = client.auth.getAccessToken?.();
    if (token) {
      setToken(token);
      return token;
    }
    return null;
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
