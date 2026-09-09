/**
 * Account tiers (product access groups):
 * - free_user  — trial / limited surface
 * - pro_user   — full product, except admin-only WIP
 * - admin      — everything, including in-dev features (Ask Mira analyst, …)
 *
 * Tier resolution:
 * 1) email in ADMIN_EMAILS → admin
 * 2) workspace.plan in pro plans → pro_user
 * 3) else → free_user
 */

export const TIERS = Object.freeze({
  FREE: 'free_user',
  PRO: 'pro_user',
  ADMIN: 'admin',
});

/** Features only platform admins may use (in development / internal). */
export const ADMIN_ONLY_FEATURES = Object.freeze([
  'ask_mira_analyst',
]);

/** Features available on the free trial. Everything else requires pro+. */
export const FREE_FEATURES = Object.freeze([
  'core_analysis',
  'competitors',
  'changes',
  'alerts',
  'reports',
  'moves',
  'my_product',
  'discover',
  'methodology',
  'usage',
  'settings',
]);

/** Pro (and admin) get the full product surface. */
export const PRO_FEATURES = Object.freeze([
  ...FREE_FEATURES,
  'market_model',
  'distribution',
  'compare',
  'deep_dive',
  'labs',
  'positioning_lab',
  'pricing_lab',
  'feature_gaps',
  'evidence',
  'war_room',
  'win_loss',
  'market_entry',
  'investor',
]);

const PRO_PLANS = new Set(['pro', 'team', 'business', 'paid', 'enterprise']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function adminEmails() {
  const fromEnv = String(process.env.ADMIN_EMAILS || 'shanmukhsain@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(fromEnv);
}

export function resolveAccountTier(email, workspacePlan = 'free') {
  const normalized = normalizeEmail(email);
  // The account-free app has one shared actor and exposes the full product.
  if (!normalized) return TIERS.ADMIN;
  if (normalized && adminEmails().has(normalized)) return TIERS.ADMIN;

  const plan = String(workspacePlan || 'free').toLowerCase();
  if (PRO_PLANS.has(plan)) return TIERS.PRO;
  return TIERS.FREE;
}

export function featuresForTier(tier) {
  if (tier === TIERS.ADMIN) {
    return new Set([...PRO_FEATURES, ...ADMIN_ONLY_FEATURES]);
  }
  if (tier === TIERS.PRO) {
    return new Set(PRO_FEATURES);
  }
  return new Set(FREE_FEATURES);
}

export function resolveEntitlements(email, workspacePlan = 'free') {
  const tier = resolveAccountTier(email, workspacePlan);
  const features = featuresForTier(tier);
  return {
    tier,
    features: [...features].sort(),
    isAdmin: tier === TIERS.ADMIN,
    isPro: tier === TIERS.PRO || tier === TIERS.ADMIN,
    isFree: tier === TIERS.FREE,
  };
}

export function hasFeature(entitlements, feature) {
  if (!feature) return true;
  const list = entitlements?.features;
  if (Array.isArray(list)) return list.includes(feature);
  if (list instanceof Set) return list.has(feature);
  return false;
}
