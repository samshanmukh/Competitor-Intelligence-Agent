/** Local-only auth bypass. Never active in production / hosted environments. */

export const DEV_BYPASS_TOKEN = 'dev-bypass';
export const DEV_BYPASS_USER = Object.freeze({
  id: 'local-dev-user',
  email: 'dev@localhost',
});

function flagOn(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

export function authBypassConfigured() {
  if (!flagOn(process.env.AUTH_BYPASS)) return false;
  if (process.env.NODE_ENV === 'production') return false;
  // Hosted platforms — refuse even if someone sets the flag by mistake.
  if (process.env.RENDER || process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT) return false;
  return true;
}

function hostIsLocal(host) {
  if (!host) return false;
  const h = String(host).toLowerCase().split(':')[0];
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

/** True when this Express request is clearly local loopback. */
export function isLocalRequest(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname;
  if (hostIsLocal(host)) return true;

  const origin = req.headers.origin || req.headers.referer || '';
  try {
    if (origin && hostIsLocal(new URL(origin).hostname)) return true;
  } catch {
    /* ignore */
  }

  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

export function authBypassActive(req) {
  return authBypassConfigured() && isLocalRequest(req);
}

export function isDevBypassToken(token) {
  return token === DEV_BYPASS_TOKEN;
}
