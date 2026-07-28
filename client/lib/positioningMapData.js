/**
 * Pure helpers for the landing Positioning map.
 * Unpriced rivals still plot — clustered in an "unpriced" lane (not $0).
 */

const DEFAULT_VALUE_RIVAL = 5.5;
const DEFAULT_VALUE_YOU = 6;
const FALLBACK_UNPRICED_X = 100;

/** X position for competitors with no entry_price (right of known prices). */
export function resolveUnpricedLaneX(knownPrices = []) {
  const prices = knownPrices.filter((p) => Number.isFinite(p) && p > 0);
  if (!prices.length) return FALLBACK_UNPRICED_X;
  return Math.round(Math.max(...prices) * 1.15 * 100) / 100;
}

/**
 * Build scatter points for you + rivals.
 * Always includes every named competitor; missing prices use the unpriced lane;
 * missing value_score gets a mid heuristic so Y is never empty.
 *
 * @returns {{ points: object[], unpricedX: number, knownCount: number }}
 */
export function buildPositioningMapPoints(you, rivals = []) {
  const raw = [];
  if (you && (you.name || you.website)) {
    raw.push({ ...you, isYou: true });
  }
  for (const r of rivals || []) {
    if (!r || (!r.name && !r.website)) continue;
    raw.push({ ...r, isYou: false });
  }

  const knownPrices = raw
    .map((r) => r.entry_price)
    .filter((p) => p != null && Number.isFinite(Number(p)) && Number(p) > 0)
    .map(Number);
  const unpricedX = resolveUnpricedLaneX(knownPrices);

  const points = raw.map((c) => {
    const priceNum = c.entry_price != null ? Number(c.entry_price) : null;
    const priceUnknown = priceNum == null || !Number.isFinite(priceNum) || priceNum <= 0;
    const valueNum = c.value_score != null ? Number(c.value_score) : null;
    const valueEstimated = valueNum == null || !Number.isFinite(valueNum);
    const statement = String(c.statement || c.blurb || '').replace(/\s+/g, ' ').trim() || null;
    return {
      name: c.name || c.website || 'Unknown',
      shortName: c.name || c.website || 'Unknown',
      price: priceUnknown ? unpricedX : priceNum,
      rawPrice: priceUnknown ? null : priceNum,
      value: valueEstimated
        ? (c.isYou ? DEFAULT_VALUE_YOU : DEFAULT_VALUE_RIVAL)
        : Math.max(1, Math.min(10, valueNum)),
      priceUnknown,
      valueEstimated,
      isYou: Boolean(c.isYou),
      website: c.website,
      pricing_url: c.pricing_url,
      ...(statement ? { statement } : {}),
    };
  });

  return { points, unpricedX, knownCount: knownPrices.length };
}
