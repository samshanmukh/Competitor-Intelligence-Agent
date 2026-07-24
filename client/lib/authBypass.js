/** Shared helpers for localhost-only auth bypass (Next middleware + client). */

export const DEV_BYPASS_TOKEN = 'dev-bypass';

function flagOn(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

export function authBypassConfigured() {
  // Prefer server-only AUTH_BYPASS; NEXT_PUBLIC_ is optional for client hints.
  const flag = process.env.AUTH_BYPASS || process.env.NEXT_PUBLIC_AUTH_BYPASS;
  if (!flagOn(flag)) return false;
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.VERCEL || process.env.RENDER) return false;
  return true;
}

export function hostIsLocal(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase().split(':')[0];
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

export function authBypassActiveForHost(hostname) {
  return authBypassConfigured() && hostIsLocal(hostname);
}
