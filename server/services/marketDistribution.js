// Revenue-implied + triangulated market presence across tracked competitors.

const WEIGHTS = { revenue: 0.4, traffic: 0.25, reviews: 0.2 };
const WEIGHTS_RELATIVE_TRAFFIC = { revenue: 0.42, traffic: 0.15, reviews: 0.22 };

export function parseMoneyToUsd(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

  const s = String(value).trim().replace(/,/g, '');
  if (!s || /^null$/i.test(s)) return null;

  const m = s.match(/([\d.]+)\s*(trillion|billion|million|thousand|t|b|m|k)?/i);
  if (!m) return null;

  let n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;

  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('t')) n *= 1e12;
  else if (unit.startsWith('b')) n *= 1e9;
  else if (unit.startsWith('m')) n *= 1e6;
  else if (unit.startsWith('k')) n *= 1e3;

  return Math.round(n);
}

export function resolveTamUsd({ marketModel, marketIntel }) {
  const fromModel = marketModel?.tam?.value_usd;
  if (typeof fromModel === 'number' && fromModel > 0) {
    return { tamUsd: fromModel, tamSource: 'market_model' };
  }

  const hist = marketIntel?.history;
  if (Array.isArray(hist) && hist.length) {
    const last = hist[hist.length - 1];
    if (typeof last?.size_usd_millions === 'number' && last.size_usd_millions > 0) {
      return { tamUsd: last.size_usd_millions * 1e6, tamSource: 'research_history' };
    }
  }

  const parsed = parseMoneyToUsd(marketIntel?.size_current);
  if (parsed && parsed > 0) return { tamUsd: parsed, tamSource: 'research_current' };

  return { tamUsd: null, tamSource: null };
}

function normalizeScores(values) {
  const max = Math.max(0, ...values);
  if (!max) return values.map(() => 0);
  return values.map((v) => (v > 0 ? (v / max) * 100 : 0));
}

function countSignalTypes(items) {
  let revenue = 0;
  let traffic = 0;
  let reviews = 0;
  for (const it of items) {
    if (it.signals?.revenue > 0) revenue++;
    if (it.signals?.traffic != null) traffic++;
    if (it.signals?.reviews != null) reviews++;
  }
  return { revenue, traffic, reviews };
}

/**
 * @param {object} [signals]
 * @param {Record<string, number>} [signals.trafficByName] — monthly visits keyed by lowercase name
 * @param {Record<string, 'research'|'relative'>} [signals.trafficKinds]
 * @param {Record<string, { count?: number, rating?: number }>} [signals.reviewByName]
 */
export function computeMarketDistribution(companies, tamUsd, tamSource = null, signals = {}) {
  const { trafficByName = {}, trafficKinds = {}, reviewByName = {} } = signals;

  const absoluteTrafficCount = Object.values(trafficKinds).filter((k) => k === 'research').length;
  const relativeTrafficCount = Object.values(trafficKinds).filter((k) => k === 'relative').length;
  const weights =
    relativeTrafficCount > absoluteTrafficCount ? WEIGHTS_RELATIVE_TRAFFIC : WEIGHTS;

  const enriched = (companies || [])
    .filter((c) => c?.name)
    .map((c) => {
      const key = c.name.toLowerCase();
      const revenue_usd = c.revenue_usd ?? parseMoneyToUsd(c.revenue);
      const reviewMeta = reviewByName[key] || {};
      const review_count = toNum(c.review_count) ?? reviewMeta.count ?? null;
      const g2_rating = toNum(c.g2_rating) ?? reviewMeta.rating ?? null;
      const monthly_visits = trafficByName[key] ?? null;
      return {
        ...c,
        revenue_usd: revenue_usd > 0 ? revenue_usd : null,
        monthly_visits: monthly_visits > 0 ? monthly_visits : null,
        review_count: review_count > 0 ? review_count : null,
        g2_rating,
      };
    });

  const withAny = enriched.filter((c) => c.revenue_usd || c.monthly_visits || c.review_count);
  if (!withAny.length) {
    return emptyDistribution(tamUsd, tamSource, 'No revenue, traffic, or review signals for tracked competitors.');
  }

  const revenueVals = enriched.map((c) => c.revenue_usd || 0);
  const trafficVals = enriched.map((c) => c.monthly_visits || 0);
  const reviewVals = enriched.map((c) => c.review_count || (c.g2_rating ? c.g2_rating * 25 : 0));

  const revScores = normalizeScores(revenueVals);
  const trafficScores = normalizeScores(trafficVals);
  const reviewScores = normalizeScores(reviewVals);

  const rawComposites = enriched.map((c, i) => {
    let weight = 0;
    let score = 0;
    if (revenueVals[i] > 0) {
      score += weights.revenue * revScores[i];
      weight += weights.revenue;
    }
    if (trafficVals[i] > 0) {
      score += weights.traffic * trafficScores[i];
      weight += weights.traffic;
    }
    if (reviewVals[i] > 0) {
      score += weights.reviews * reviewScores[i];
      weight += weights.reviews;
    }
    return weight > 0 ? score / weight : 0;
  });

  const compositeTotal = rawComposites.reduce((s, v) => s + v, 0) || 1;

  const items = enriched
    .map((c, i) => {
      const share_pct_tam =
        tamUsd && c.revenue_usd ? Math.round((c.revenue_usd / tamUsd) * 1000) / 10 : null;
      const presence_pct = Math.round((rawComposites[i] / compositeTotal) * 1000) / 10;
      return {
        name: c.name,
        revenue_usd: c.revenue_usd,
        monthly_visits: c.monthly_visits,
        review_count: c.review_count,
        share_pct: share_pct_tam ?? presence_pct,
        share_pct_tam,
        presence_pct,
        signals: {
          revenue: revenueVals[i] > 0 ? Math.round(revScores[i] * 10) / 10 : null,
          traffic: trafficVals[i] > 0 ? Math.round(trafficScores[i] * 10) / 10 : null,
          reviews: reviewVals[i] > 0 ? Math.round(reviewScores[i] * 10) / 10 : null,
          traffic_kind: trafficKinds[c.name.toLowerCase()] || (trafficVals[i] > 0 ? 'research' : null),
        },
      };
    })
    .filter((it) => it.presence_pct > 0 || it.share_pct_tam > 0)
    .sort((a, b) => (b.presence_pct || 0) - (a.presence_pct || 0));

  const signalCounts = countSignalTypes(items);
  const signalTypesUsed = [signalCounts.revenue, signalCounts.traffic, signalCounts.reviews].filter((n) => n >= 2).length;
  const method = signalTypesUsed >= 2 ? 'triangulated' : tamUsd ? 'revenue_implied' : 'relative_revenue';

  const trackedSum = items.reduce((s, i) => s + (i.share_pct_tam ?? 0), 0);
  const cr4 = items.slice(0, 4).reduce((s, i) => s + (i.presence_pct || 0), 0);

  return {
    items,
    cr4_pct: Math.round(cr4 * 10) / 10,
    tam_usd: tamUsd,
    tam_source: tamSource,
    method,
    signal_counts: signalCounts,
    traffic_meta: signals.trafficMeta || null,
    tracked_sum_pct: tamUsd ? Math.round(trackedSum * 10) / 10 : 100,
    remainder_pct: tamUsd ? Math.max(0, Math.round((100 - trackedSum) * 10) / 10) : null,
    disclaimer: disclaimerFor(method, signalCounts, tamUsd, signals.trafficMeta),
  };
}

function emptyDistribution(tamUsd, tamSource, msg) {
  return {
    items: [],
    cr4_pct: null,
    tam_usd: tamUsd,
    tam_source: tamSource,
    method: 'none',
    signal_counts: { revenue: 0, traffic: 0, reviews: 0 },
    tracked_sum_pct: null,
    remainder_pct: null,
    disclaimer: msg,
  };
}

function disclaimerFor(method, signalCounts, tamUsd, trafficMeta) {
  if (method === 'triangulated') {
    const parts = [];
    if (signalCounts.revenue) parts.push('estimated revenue');
    if (signalCounts.traffic) parts.push('web traffic');
    if (signalCounts.reviews) parts.push('review activity');
    let extra = '';
    if (trafficMeta?.research) extra += ` Research traffic: ${trafficMeta.research}.`;
    return `Triangulated presence from ${parts.join(', ')} — directional estimates, not syndicated market share.${
      tamUsd ? ' TAM-based revenue share shown where available.' : ''
    }${extra}`;
  }
  if (method === 'revenue_implied') {
    return 'Directional estimates: estimated company revenue ÷ category TAM. Private-company revenue is inferred from research.';
  }
  return 'Relative scale among tracked competitors by estimated revenue. Build a market model on /market for TAM-based shares.';
}

function toNum(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Minimum presence shift (percentage points) to include in pulse summaries. */
export const PULSE_SHIFT_PP = 0.5;

/** Shifts at or above this threshold trigger push alerts (Phase 4). */
export const SIGNIFICANT_SHIFT_PP = 5;

export function getSignificantShifts(pulse) {
  return (pulse?.shifts || []).filter((s) => Math.abs(s.delta_pct) >= SIGNIFICANT_SHIFT_PP);
}

/** Compare two distribution snapshots for pulse / digest. */
export function diffDistribution(prev, next) {
  if (!prev?.items?.length || !next?.items?.length) {
    return { shifts: [], summary: 'First market distribution snapshot — run again later to see shifts.' };
  }

  const prevMap = new Map(prev.items.map((i) => [i.name.toLowerCase(), i]));
  const shifts = [];

  for (const item of next.items) {
    const p = prevMap.get(item.name.toLowerCase());
    const prevPct = p?.presence_pct ?? p?.share_pct ?? 0;
    const nextPct = item.presence_pct ?? item.share_pct ?? 0;
    const delta = Math.round((nextPct - prevPct) * 10) / 10;
    if (Math.abs(delta) >= PULSE_SHIFT_PP) {
      shifts.push({ name: item.name, prev_pct: prevPct, next_pct: nextPct, delta_pct: delta });
    }
  }

  shifts.sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct));

  const summary =
    shifts.length > 0
      ? shifts
          .slice(0, 3)
          .map((s) => `${s.name} ${s.delta_pct > 0 ? '+' : ''}${s.delta_pct}pp`)
          .join(' · ')
      : 'No meaningful presence shifts since your last market snapshot.';

  return { shifts, summary };
}

/** Diff saved report distribution vs current workspace snapshot. */
export function diffReportDistribution(reportMarket, currentDistribution) {
  const prev = reportMarket?.distribution;
  if (!prev?.items?.length || !currentDistribution?.items?.length) {
    return { shifts: [], summary: null, available: false };
  }
  const pulse = diffDistribution(prev, currentDistribution);
  return { ...pulse, available: pulse.shifts.length > 0 || Boolean(prev.items.length) };
}

export function distributionSnapshotKey(workspaceId) {
  return `distribution_snapshot:${workspaceId}`;
}

/** Merge distribution fields back onto company rows for the financials cards. */
export function enrichCompaniesWithDistribution(companies, distribution) {
  const byName = new Map((distribution?.items || []).map((i) => [i.name.toLowerCase(), i]));
  return (companies || []).map((c) => {
    const hit = byName.get(c.name?.toLowerCase());
    if (!hit) return c;
    return {
      ...c,
      revenue_usd: hit.revenue_usd ?? c.revenue_usd,
      share_pct: hit.share_pct_tam ?? hit.share_pct,
      presence_pct: hit.presence_pct,
      share_method: distribution?.method,
    };
  });
}
