import { ensureUserHasWorkspace, isWorkspaceMember } from '../db/workspace.js';
import { runWithWorkspaceKeys } from '../services/workspaceExecution.js';
import {
  authBypassActive,
  DEV_BYPASS_USER,
  isDevBypassToken,
} from '../lib/authBypass.js';

const INSFORGE_URL = process.env.INSFORGE_BASE_URL?.replace(/\/$/, '');
if (!INSFORGE_URL) {
  throw new Error('INSFORGE_BASE_URL is required');
}

// Validate a bearer token against Insforge, which verifies the signature AND
// expiry — so forged/expired tokens are rejected (fixes the decode-only hole).
// Results are cached briefly to avoid a round-trip on every request.
const _tokenCache = new Map(); // token -> { user, exp }
const CACHE_MS = 5 * 60 * 1000;

async function verifyToken(token) {
  const now = Date.now();
  const hit = _tokenCache.get(token);
  if (hit && hit.exp > now) return { ok: true, user: hit.user };
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${INSFORGE_URL}/api/auth/sessions/current`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (res.status === 401 || res.status === 403) { _tokenCache.delete(token); return { ok: false, status: 401 }; }
    if (!res.ok) return { ok: false, status: 503 }; // transient — don't force logout
    const body = await res.json().catch(() => null);
    const user = body?.user;
    if (!user?.id) return { ok: false, status: 401 };
    const result = { id: user.id, email: user.email };
    if (_tokenCache.size > 2000) _tokenCache.clear();
    _tokenCache.set(token, { user: result, exp: now + CACHE_MS });
    return { ok: true, user: result };
  } catch {
    return { ok: false, status: 503 }; // network/timeout — fail safe, not open
  }
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  // Localhost-only bypass (AUTH_BYPASS=true). Accepts the fixed dev token.
  if (authBypassActive(req) && isDevBypassToken(token)) {
    req.user = { ...DEV_BYPASS_USER };
    req.authBypass = true;
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHENTICATED' });
  }
  const v = await verifyToken(token);
  if (v.ok) { req.user = v.user; return next(); }
  if (v.status === 401) return res.status(401).json({ error: 'Invalid or expired session', code: 'INVALID_TOKEN' });
  return res.status(503).json({ error: 'Auth service unavailable, try again', code: 'AUTH_UNAVAILABLE' });
}

export async function resolveWorkspace(req, res, next) {
  const wsHeader = req.headers['x-workspace-id'];
  try {
    if (wsHeader) {
      const wsId = Number(wsHeader);
      if (!Number.isFinite(wsId)) {
        return res.status(400).json({ error: 'Invalid workspace id', code: 'BAD_WORKSPACE' });
      }
      // Never trust the caller's workspace header — verify membership first.
      const member = await isWorkspaceMember(req.user.id, wsId);
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this workspace', code: 'FORBIDDEN_WORKSPACE' });
      }
      req.workspaceId = wsId;
      return runWithWorkspaceKeys(wsId, next);
    }
    const workspace = await ensureUserHasWorkspace(req.user.id, req.user.email);
    req.workspaceId = workspace.id;
    return runWithWorkspaceKeys(workspace.id, next);
  } catch (err) {
    next(err);
  }
}
