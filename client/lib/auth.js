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

async function ensureWorkspace(token) {
  const res = await fetch(`${API_BASE}/api/auth/ensure-workspace`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const { workspace } = await res.json();
  return workspace;
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

export async function signInWithOAuth(provider, { from } = {}) {
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  const returnPath = safeReturnPath(from);
  rememberReturnPath(returnPath);
  if (returnPath !== '/app') callbackUrl.searchParams.set('from', returnPath);
  const redirectTo = callbackUrl.toString();
  const { error } = await getClient().auth.signInWithOAuth(provider, { redirectTo });
  if (error) throw new Error(error.message || 'OAuth sign in failed');
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
  const { workspaces } = await res.json();
  return workspaces || [];
}

export function switchWorkspace(ws) {
  setWorkspace(ws);
  window.location.reload();
}
