/**
 * Ensure a user-pasted URL has an http(s) scheme.
 * - empty / whitespace → ''
 * - already has a scheme (https:, http:, mailto:, …) → unchanged
 * - bare host / path (goremy.ai, www.x.com/pricing) → https://…
 */
export function ensureHttps(value) {
  const t = String(value ?? '').trim();
  if (!t) return '';
  if (/^[a-z][a-z0-9+\-.]*:/i.test(t)) return t;
  return `https://${t.replace(/^\/+/, '')}`;
}

/** Alias — same behavior as ensureHttps. */
export function normalizeHttpUrl(value) {
  return ensureHttps(value);
}
