/**
 * Client helpers for account tiers: free_user | pro_user | admin
 */

const NAV_FEATURE = {
  '/app': 'core_analysis',
  '/analyst': 'ask_mira_analyst',
  '/market': 'market_model',
  '/distribution': 'distribution',
  '/competitors': 'competitors',
  '/compare': 'compare',
  '/company': 'deep_dive',
  '/moves': 'moves',
  '/changes': 'changes',
  '/notifications': 'alerts',
  '/reports': 'reports',
  '/positioning': 'positioning_lab',
  '/pricing-lab': 'pricing_lab',
  '/gaps': 'feature_gaps',
  '/evidence': 'evidence',
  '/war-room': 'war_room',
  '/win-loss': 'win_loss',
  '/market-entry': 'market_entry',
  '/investor': 'investor',
  '/my-product': 'my_product',
  '/discover': 'discover',
  '/methodology': 'methodology',
  '/usage': 'usage',
  '/settings': 'settings',
};

export function featureForPath(pathname) {
  if (!pathname) return null;
  if (NAV_FEATURE[pathname]) return NAV_FEATURE[pathname];
  const hit = Object.keys(NAV_FEATURE).find(
    (p) => p !== '/app' && pathname.startsWith(`${p}/`),
  );
  return hit ? NAV_FEATURE[hit] : null;
}

export function hasFeature(entitlements, feature) {
  if (!feature) return true;
  return Boolean(entitlements?.features?.includes(feature));
}

export function canAccessPath(entitlements, pathname) {
  // Until the workspace context loads, keep navigation visible.
  if (!entitlements) return true;
  const feature = featureForPath(pathname);
  if (!feature) return true;
  return hasFeature(entitlements, feature);
}

export function tierLabel(tier) {
  if (tier === 'admin') return 'Admin';
  if (tier === 'pro_user') return 'Pro';
  return 'Free';
}
