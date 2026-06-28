import { ensureUserHasWorkspace } from '../db/workspace.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHENTICATED' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = decodeJWT(token);
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

export async function resolveWorkspace(req, res, next) {
  const wsHeader = req.headers['x-workspace-id'];
  if (wsHeader) {
    req.workspaceId = Number(wsHeader);
    return next();
  }
  try {
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
