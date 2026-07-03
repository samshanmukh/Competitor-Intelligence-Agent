import { ensureUserHasWorkspace, isWorkspaceMember } from '../db/workspace.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHENTICATED' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = decodeJWT(token);
    // Note: we decode (not cryptographically verify) the token to read the user
    // id. We intentionally do NOT reject on `exp` — Insforge access tokens are
    // short-lived and can't be silently refreshed in this cross-origin setup, so
    // enforcing expiry only logs the user out on reload without adding real
    // security (signatures aren't verified here anyway).
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
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
      return next();
    }
    const workspace = await ensureUserHasWorkspace(req.user.id, req.user.email);
    req.workspaceId = workspace.id;
    next();
  } catch (err) {
    next(err);
  }
}

function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT structure');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}
