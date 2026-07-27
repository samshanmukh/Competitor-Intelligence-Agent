/**
 * Feature matrix cell model: four states with optional evidence.
 *   included   (✓) — clearly included in the product/plan
 *   limited    (△) — available in a limited way, add-on, or requires coach/plan
 *   absent     (×) — not available per sources
 *   unverified (?) — sources insufficient to judge
 */

export const FEATURE_STATUSES = ['included', 'limited', 'absent', 'unverified'];

const STATUS_ALIASES = {
  true: 'included',
  yes: 'included',
  included: 'included',
  full: 'included',
  false: 'absent',
  no: 'absent',
  absent: 'absent',
  missing: 'absent',
  none: 'absent',
  limited: 'limited',
  partial: 'limited',
  delta: 'limited',
  addon: 'limited',
  'add-on': 'limited',
  requires_coach: 'limited',
  premium_only: 'limited',
  unverified: 'unverified',
  unknown: 'unverified',
  null: 'unverified',
  '?': 'unverified',
};

export function normalizeFeatureStatus(raw) {
  if (raw === true) return 'included';
  if (raw === false) return 'absent';
  if (raw == null) return 'unverified';
  const key = String(raw).trim().toLowerCase();
  return STATUS_ALIASES[key] || 'unverified';
}

export function normalizeFeatureCell(raw, fallbackUrl = null) {
  const now = new Date().toISOString();
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const status = normalizeFeatureStatus(raw.status ?? raw.value ?? raw.state ?? raw.flag);
    return {
      status,
      evidence: (raw.evidence || raw.note || raw.quote || '').trim() || null,
      source_url: raw.source_url || raw.source || raw.url || fallbackUrl || null,
      plan: (raw.plan || raw.tier || raw.plan_tier || '').trim() || null,
      verified_at: raw.verified_at || raw.verifiedAt || now,
    };
  }
  return {
    status: normalizeFeatureStatus(raw),
    evidence: null,
    source_url: fallbackUrl || null,
    plan: null,
    verified_at: now,
  };
}

export function normalizeFeatureCells(list, n, fallbackUrl = null) {
  const arr = Array.isArray(list) ? list : [];
  return Array.from({ length: n }, (_, i) => normalizeFeatureCell(arr[i], fallbackUrl));
}

/** 1 = included, 0.5 = limited, 0 otherwise — for coverage charts. */
export function featurePresentScore(cell) {
  const status = typeof cell === 'object' && cell ? cell.status : normalizeFeatureStatus(cell);
  if (status === 'included') return 1;
  if (status === 'limited') return 0.5;
  return 0;
}

export function featureCellFilled(cell) {
  const status = typeof cell === 'object' && cell ? cell.status : normalizeFeatureStatus(cell);
  return status === 'included' || status === 'limited' || status === 'absent';
}

/**
 * Guidance embedded in LLM prompts so feature rows stay precise
 * (avoids overloaded labels like "human coach" / "nutrition support").
 */
export const FEATURE_ROW_GUIDANCE = `Prefer precise, comparable capability rows. When the market involves coaching / training apps, SPLIT overloaded ideas:

Use separate rows instead of vague labels:
- "Human-designed methodology" (plans authored by coaches / sports science — not live chat)
- "Direct human-coach messaging" (athlete can message a coach in-product)
- "Dedicated personal coach" (1:1 assigned coach included or hireable in-product)
- "Integrated strength workouts" (strength sessions in the training calendar — not just blog tips)
- "Nutrition content" (in-app fueling tips / articles)
- "Nutritionist access" (ability to consult a nutrition specialist)
- "Adaptive plan recalculation" (plan updates after missed workouts / fitness / goal changes)
- "Community / social features" (peer community, clubs, group challenges)
- "Wearable device sync"
- "Free trial available"

Avoid combining different capabilities into one row (e.g. do not use a single "Human coach interaction" or "Nutrition support" row).

Cell values MUST use four states (not boolean):
- "included" — clearly included for a typical paid plan (or free if noted)
- "limited" — available only as add-on, premium-only, requires hiring a coach, or partial equivalent
- "absent" — sources indicate it is not offered
- "unverified" — content is thin/stale/silent; do NOT default to absent

For every cell include:
- status
- evidence (short supporting statement or quote from the content)
- source_url (prefer a URL present in the content; else null)
- plan (which plan/tier the evidence refers to, if known)
`;
