/**
 * Derive a company logo URL from a website or pricing page.
 * Uses Google's favicon service (no API key), falls back to letter avatars in UI on error.
 */

export function hostnameFromUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`;
    const host = new URL(href).hostname.replace(/^www\./i, '');
    return host || null;
  } catch {
    return null;
  }
}

/** Best-effort logo for a company given any of website / pricing_url / explicit domain. */
export function companyLogoUrl({ website, pricing_url, url, domain } = {}) {
  const host = domain
    || hostnameFromUrl(website)
    || hostnameFromUrl(pricing_url)
    || hostnameFromUrl(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}
