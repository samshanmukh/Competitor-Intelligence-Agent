'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { Icon, Shimmer, ValueScore } from './ui';
import Link from 'next/link';
import {
  CHART_COLORS,
  DistributionMetaChips,
  PresenceChart,
  PulseBanner,
  SyndicatedShareTable,
} from './distribution/DistributionShared';
import { SkillChipRow, SourceAttribution } from './SourceAttribution';
const TIP_STYLE = { background: '#0e1014', border: '1px solid #181c24', borderRadius: 8, fontSize: 12 };
const AXIS = { fill: '#64748b', fontSize: 11 };

const ReportLayoutCtx = createContext('stack');

function LayerPending({ label }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-live="polite" aria-label={`Loading ${label}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Researching {label}</p>
        <span className="text-[11px] text-slate-600">Filling in…</span>
      </div>
      <Shimmer className="h-4 w-2/5" />
      <Shimmer className="h-28 w-full rounded-xl" />
      <div className="grid gap-2 sm:grid-cols-3">
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
      </div>
      <Shimmer className="h-3 w-3/5" />
    </div>
  );
}

/**
 * @param {Record<string, 'idle'|'loading'|'done'|'error'>} [layers]
 *   Progressive analysis status per tab id (icp, charts, pricing, features, value, reviews, strategy, take, market).
 */
export default function ReportView({
  competitors = [],
  matrix,
  positioning,
  reviews,
  take,
  market,
  product,
  strategy,
  layout = 'stack',
  layers = null,
}) {
  const youName = (product?.name || matrix?.productName || '').toLowerCase();
  const hasIcp = Boolean(product?.icp || product?.business_model || strategy?.icp || strategy?.business_model);
  // Pricing comparison uses approved rivals + matrix tiers. Don't hide rivals when
  // the matrix only returned the user's product (common when rival pages fail).
  const pricingEntries = buildPricingEntries(product, matrix, competitors);
  const hasPricing = Boolean(
    pricingEntries.length > 0
    || matrix?.competitors?.length > 0
    || product?.tiers?.length > 0
  );
  const hasFeatures = Boolean(matrix?.features?.length > 0);
  const panels = useMemo(() => {
    const pending = (id) => layers?.[id] === 'loading';
    const list = [];
    if (hasIcp || pending('icp')) {
      list.push({
        id: 'icp',
        label: 'ICP',
        icon: 'users',
        loading: pending('icp') && !hasIcp,
        node: hasIcp ? (
          <ReportSection
            icon="users"
            title="Who you serve & how you make money"
            skills={[{ skill: 'you-contents' }, { skill: 'grok' }]}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              {(product?.icp || strategy?.icp) && (
                <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ICP</p>
                  <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{product?.icp || strategy?.icp}</p>
                </div>
              )}
              {(product?.business_model || strategy?.business_model) && (
                <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Business model</p>
                  <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{product?.business_model || strategy?.business_model}</p>
                </div>
              )}
            </div>
          </ReportSection>
        ) : <LayerPending label="ICP & business model" />,
      });
    }
    const hasChartData = competitors.some((c) => c.value_score != null)
      || product?.value_score != null
      || (matrix?.competitors || []).some((c) => (c.tiers || []).some((t) => t.price_monthly != null));
    if (hasChartData || pending('charts') || pending('value')) {
      list.push({
        id: 'charts',
        label: 'Map',
        icon: 'bar',
        loading: pending('charts') && !hasChartData,
        node: hasChartData
          ? <ChartsSection competitors={competitors} matrix={matrix} reviews={reviews} product={product} />
          : <LayerPending label="positioning map" />,
      });
    }
    if (hasPricing || pending('pricing')) {
      list.push({
        id: 'pricing',
        label: 'Pricing',
        icon: 'card',
        loading: pending('pricing') && !hasPricing,
        node: hasPricing ? (
          <ReportSection
            icon="card"
            title="Pricing & plans"
            skills={[{ skill: 'you-contents' }, { skill: 'grok' }]}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pricingEntries.map((c) => (
                <PricingCard
                  key={c.name}
                  name={c.name}
                  tiers={c.tiers}
                  you={c.you}
                  loading={pending('pricing') && !(c.tiers || []).length}
                />
              ))}
            </div>
          </ReportSection>
        ) : <LayerPending label="pricing" />,
      });
    }
    if (hasFeatures || pending('features')) {
      list.push({
        id: 'features',
        label: 'Features',
        icon: 'grid',
        loading: pending('features') && !hasFeatures,
        node: hasFeatures ? (
          <ReportSection
            icon="grid"
            title="Feature matrix"
            skills={[{ skill: 'you-contents' }, { skill: 'grok' }]}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-slate-500">Feature</th>
                    {matrix.competitors.map((c) => {
                      const isYou = (c.name || '').toLowerCase() === youName;
                      return (
                        <th key={c.name} className={`px-3 py-2 text-center text-xs font-medium ${isYou ? 'text-accent-soft' : 'text-slate-300'}`}>
                          {c.name}{isYou && <span className="block text-[9px] font-normal text-accent-soft/70">you</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {matrix.features.map((f, fi) => (
                    <tr key={fi}>
                      <td className="py-2 pr-4 text-xs text-slate-300">{f}</td>
                      {matrix.competitors.map((c) => {
                        const isYou = (c.name || '').toLowerCase() === youName;
                        const has = c.tiers?.[0]?.features?.[fi];
                        return (
                          <td key={c.name} className={`px-3 py-2 text-center ${isYou ? 'bg-accent/5' : ''}`}>
                            {has === true ? <Icon name="check" className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                              : has === false ? <Icon name="x" className="mx-auto h-3.5 w-3.5 text-slate-700" />
                              : <span className="text-slate-700">–</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ) : <LayerPending label="feature matrix" />,
      });
    }
    if (competitors.length || pending('value')) {
      list.push({
        id: 'value',
        label: 'Value',
        icon: 'trending',
        loading: pending('value') && !competitors.some((c) => c.value_score != null) && !positioning,
        node: (
          <ReportSection
            icon="trending"
            title="Business value"
            skills={[{ skill: 'you-contents' }, { skill: 'grok' }]}
          >
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {product && (product.value_score != null || product.value_analysis) && (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-accent-soft">{product.name} <span className="text-[10px] font-normal">(you)</span></span>
                    <ValueScore score={product.value_score} />
                  </div>
                  {product.value_analysis && <p className="mt-1 text-xs text-slate-400 line-clamp-3">{product.value_analysis}</p>}
                </div>
              )}
              {competitors.map((c) => (
                <div key={c.id ?? c.name} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    {c.value_score == null && pending('value')
                      ? <Shimmer className="h-3.5 w-10 rounded-full" />
                      : <ValueScore score={c.value_score} />}
                  </div>
                  {c.value_analysis && <p className="mt-1 text-xs text-slate-500 line-clamp-3">{c.value_analysis}</p>}
                </div>
              ))}
            </div>
            {positioning
              ? <Prose text={positioning} />
              : pending('value') && <LayerPending label="value comparison" />}
          </ReportSection>
        ),
      });
    }
    if (reviews?.length || pending('reviews')) {
      list.push({
        id: 'reviews',
        label: 'Reviews',
        icon: 'users',
        loading: pending('reviews'),
        node: reviews?.length
          ? <ReviewsSection reviews={reviews} />
          : <LayerPending label="reviews" />,
      });
    }
    if (strategy || pending('strategy')) {
      list.push({
        id: 'strategy',
        label: 'Strategy',
        icon: 'shield',
        loading: pending('strategy') && !strategy,
        node: strategy
          ? <StrategySection strategy={strategy} productName={product?.name} />
          : <LayerPending label="strategy" />,
      });
    }
    if (take || pending('take')) {
      list.push({
        id: 'take',
        label: 'Take',
        icon: 'sparkle',
        loading: pending('take') && !take,
        node: take ? (
          <ReportSection icon="sparkle" title="Analyst take" skills={[{ skill: 'grok' }]}>
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4"><Prose text={take} /></div>
          </ReportSection>
        ) : <LayerPending label="analyst take" />,
      });
    }
    if (market || pending('market')) {
      list.push({
        id: 'market',
        label: 'Market',
        icon: 'trending',
        loading: pending('market') && !market,
        node: market ? <MarketSection market={market} /> : <LayerPending label="market intelligence" />,
      });
    }
    return list.filter((p) => p.node != null);
  }, [
    competitors, matrix, positioning, reviews, take, market, product, strategy,
    hasIcp, hasPricing, hasFeatures, youName, layers, pricingEntries,
  ]);

  const [tab, setTab] = useState(panels[0]?.id || 'value');
  const [pinnedTab, setPinnedTab] = useState(false);
  // Tabs that just finished — pulse + "Ready" chip to alert the user.
  const [justReady, setJustReady] = useState(() => new Set());
  const prevLoadingRef = useRef({});

  useEffect(() => {
    const prev = prevLoadingRef.current;
    const nextPrev = {};
    const newlyReady = [];
    for (const p of panels) {
      nextPrev[p.id] = Boolean(p.loading);
      if (prev[p.id] === true && !p.loading) newlyReady.push(p.id);
    }
    prevLoadingRef.current = nextPrev;
    if (!newlyReady.length) return;

    setJustReady((set) => {
      const n = new Set(set);
      newlyReady.forEach((id) => n.add(id));
      return n;
    });
    const clear = setTimeout(() => {
      setJustReady((set) => {
        const n = new Set(set);
        newlyReady.forEach((id) => n.delete(id));
        return n;
      });
    }, 4500);

    // Auto-open the first newly ready tab if the user hasn't chosen one yet,
    // or if they're still sitting on a loading tab.
    const activeLoading = panels.find((p) => p.id === tab)?.loading;
    if (!pinnedTab || activeLoading) {
      setTab(newlyReady[0]);
    }

    return () => clearTimeout(clear);
  }, [panels, pinnedTab, tab]);

  // If current tab disappears, fall back; otherwise stay put while loading tabs are locked.
  useEffect(() => {
    if (!panels.some((p) => p.id === tab) && panels[0]) {
      const firstReady = panels.find((p) => !p.loading) || panels[0];
      setTab(firstReady.id);
    }
  }, [panels, tab]);

  if (layout === 'tabs') {
    const active = panels.find((p) => p.id === tab) || panels.find((p) => !p.loading) || panels[0];
    return (
      <ReportLayoutCtx.Provider value="tabs">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 overflow-x-auto border-b border-white/10 px-2 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div role="tablist" aria-label="Report sections" className="flex min-w-max gap-1 pb-2">
              {panels.map((p) => {
                const on = p.id === active?.id;
                const readyFlash = justReady.has(p.id);
                const locked = p.loading;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-busy={locked || undefined}
                    disabled={locked}
                    title={locked ? `${p.label} still researching…` : readyFlash ? `${p.label} ready` : p.label}
                    onClick={() => {
                      if (locked) return;
                      setPinnedTab(true);
                      setTab(p.id);
                      setJustReady((set) => {
                        if (!set.has(p.id)) return set;
                        const n = new Set(set);
                        n.delete(p.id);
                        return n;
                      });
                    }}
                    className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm ${
                      locked
                        ? 'cursor-not-allowed text-slate-600'
                        : on
                          ? 'bg-white/10 text-white ring-1 ring-white/10'
                          : readyFlash
                            ? 'bg-accent/15 text-accent-soft ring-1 ring-accent/40 tab-ready'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    {locked ? (
                      <span className="relative h-3.5 w-8 overflow-hidden rounded-full">
                        <Shimmer className="absolute inset-0 rounded-full" />
                      </span>
                    ) : (
                      <Icon name={readyFlash ? 'check' : p.icon} className={`h-3.5 w-3.5 shrink-0 ${readyFlash ? 'text-accent-soft' : 'opacity-80'}`} />
                    )}
                    <span className={locked ? 'opacity-50' : ''}>{p.label}</span>
                    {readyFlash && (
                      <span className="rounded-full bg-accent/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-soft">
                        Ready
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {active?.node}
          </div>
          <div className="sr-only" aria-live="polite">
            {[...justReady].map((id) => {
              const p = panels.find((x) => x.id === id);
              return p ? <span key={id}>{p.label} research finished. </span> : null;
            })}
          </div>
        </div>
      </ReportLayoutCtx.Provider>
    );
  }

  return (
    <ReportLayoutCtx.Provider value="stack">
      <div className="space-y-8">
        {panels.map((p) => (
          <div key={p.id}>{p.node}</div>
        ))}
      </div>
    </ReportLayoutCtx.Provider>
  );
}

/* ───────────────────────── Charts & visuals ───────────────────────── */
function entryPrice(comp) {
  const prices = (comp?.tiers || []).map((t) => t.price_monthly).filter((p) => typeof p === 'number' && p > 0);
  return prices.length ? Math.min(...prices) : null;
}
const findByName = (arr, name) => arr?.find((x) => (x.name || '').toLowerCase() === (name || '').toLowerCase());

function ChartCard({ title, hint, children }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function normName(name) {
  return String(name || '').toLowerCase().replace(/\s*\(you\)\s*$/i, '').trim();
}

/** One card per product + approved rival, filled from matrix tiers when available. */
function buildPricingEntries(product, matrix, competitors) {
  const youKey = normName(product?.name || matrix?.productName);
  const byName = new Map();
  for (const c of matrix?.competitors || []) {
    const key = normName(c.name);
    if (!key) continue;
    byName.set(key, c);
  }

  const entries = [];
  const seen = new Set();

  if (product?.name || youKey) {
    const key = youKey || normName(product.name);
    const fromMatrix = byName.get(key);
    const tiers = (product?.tiers?.length ? product.tiers : null) || fromMatrix?.tiers || [];
    const name = product?.name || fromMatrix?.name || matrix?.productName;
    if (name) {
      entries.push({ name, tiers, you: true });
      seen.add(key);
    }
  }

  for (const c of competitors || []) {
    const key = normName(c.name);
    if (!key || seen.has(key) || key === youKey) continue;
    const fromMatrix = byName.get(key)
      || [...byName.values()].find((m) => {
        const mk = normName(m.name);
        return mk.includes(key) || key.includes(mk);
      });
    entries.push({ name: c.name, tiers: fromMatrix?.tiers || [], you: false });
    seen.add(key);
  }

  // Matrix-only names (e.g. Grok used a different label) still appear.
  for (const c of matrix?.competitors || []) {
    const key = normName(c.name);
    if (!key || seen.has(key) || key === youKey) continue;
    entries.push({ name: c.name, tiers: c.tiers || [], you: false });
    seen.add(key);
  }

  return entries;
}

function PricingCard({ name, tiers, you, loading }) {
  return (
    <div className={`rounded-lg border p-3 ${you ? 'border-accent/40 bg-accent/5' : 'border-ink-700 bg-ink-850'}`}>
      <p className={`text-sm font-semibold ${you ? 'text-accent-soft' : 'text-white'}`}>
        {name}{you && <span className="text-[10px] font-normal"> (you)</span>}
      </p>
      <div className="mt-2 space-y-1.5">
        {(tiers || []).length === 0 && (
          <p className="text-xs text-slate-600">
            {loading ? 'Extracting pricing…' : 'No pricing extracted'}
          </p>
        )}
        {(tiers || []).map((t, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{t.name}</span>
            <span className="font-medium text-slate-200">{t.price_monthly != null ? `$${t.price_monthly}/mo` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const YOU_COLOR = '#f472b6';

function truncateLabel(name, max = 16) {
  const s = String(name || '').replace(/\s*\(you\)\s*$/i, '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Zoom axes to the data cluster instead of 0–200 / full 0–10 empty space. */
function mapDomains(points) {
  const prices = points.map((d) => d.price).filter((p) => p > 0);
  const values = points.map((d) => d.value).filter((v) => v != null);
  if (!prices.length || !values.length) return { x: [0, 100], y: [0, 10] };

  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const pPad = Math.max(8, (pMax - pMin) * 0.12 || pMax * 0.08);
  const vPad = Math.max(0.4, (vMax - vMin) * 0.12 || 0.5);

  return {
    x: [Math.max(0, Math.floor(pMin - pPad)), Math.ceil(pMax + pPad)],
    y: [Math.max(0, vMin - vPad), Math.min(10, vMax + vPad)],
  };
}

/** Nudge points that share the same coordinates so dots and labels don't stack. */
function spreadMapPoints(points) {
  const buckets = new Map();
  for (const p of points) {
    const key = `${p.price?.toFixed(1)}|${p.value?.toFixed(2)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }
  const out = [];
  for (const group of buckets.values()) {
    group.forEach((p, i) => {
      if (group.length === 1) {
        out.push({ ...p, labelIndex: out.length });
        return;
      }
      const angle = (2 * Math.PI * i) / group.length;
      const priceSpread = Math.max(p.price * 0.04, 4);
      out.push({
        ...p,
        price: p.price + Math.cos(angle) * priceSpread,
        value: Math.min(10, Math.max(0, p.value + Math.sin(angle) * 0.35)),
        labelIndex: out.length,
      });
    });
  }
  return out;
}

const LABEL_OFFSETS = [
  { dx: 0, dy: -14, anchor: 'middle' },
  { dx: 0, dy: 20, anchor: 'middle' },
  { dx: 12, dy: 4, anchor: 'start' },
  { dx: -12, dy: 4, anchor: 'end' },
  { dx: 16, dy: -10, anchor: 'start' },
  { dx: -16, dy: -10, anchor: 'end' },
  { dx: 16, dy: 14, anchor: 'start' },
  { dx: -16, dy: 14, anchor: 'end' },
];

function MapPointLabel({ x, y, payload }) {
  if (x == null || y == null || !payload) return null;
  const idx = payload.labelIndex ?? 0;
  const off = LABEL_OFFSETS[idx % LABEL_OFFSETS.length];
  const isYou = payload.isYou;
  const label = truncateLabel(payload.name, isYou ? 14 : 16);
  return (
    <text
      x={x + off.dx}
      y={y + off.dy}
      fill={isYou ? YOU_COLOR : '#cbd5e1'}
      fontSize={isYou ? 11 : 10}
      fontWeight={isYou ? 700 : 400}
      textAnchor={off.anchor}
    >
      {label}{isYou ? ' ★' : ''}
    </text>
  );
}

function MapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TIP_STYLE} className="px-3 py-2 text-xs text-slate-200">
      <p className="font-semibold text-white">{d.name}</p>
      <p className="mt-1 text-slate-400">Value: {d.value ?? '—'}/10</p>
      <p className="text-slate-400">
        Entry: {d.price != null ? `$${Math.round(d.price)}/mo` : '—'}
        {d.priceEstimated ? ' (estimated)' : ''}
      </p>
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-accent/35 bg-accent/10' : 'border-ink-700 bg-ink-850'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${accent ? 'text-accent-soft' : 'text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function tierStats(tiers) {
  const prices = (tiers || []).map((t) => t.price_monthly).filter((p) => typeof p === 'number' && p >= 0);
  return {
    count: (tiers || []).length,
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
  };
}

function featureCoverage(matrixComp, featureCount) {
  if (!featureCount || !matrixComp?.tiers?.[0]?.features) return null;
  const feats = matrixComp.tiers[0].features;
  const yes = feats.filter((f) => f === true).length;
  return Math.round((yes / featureCount) * 100);
}

function ChartsSection({ competitors, matrix, reviews, product }) {
  const featureCount = matrix?.features?.length || 0;
  const youMatrix = product ? { name: product.name, tiers: product.tiers } : findByName(matrix?.competitors, matrix?.productName);

  const comp = competitors.map((c, i) => {
    const m = findByName(matrix?.competitors, c.name);
    const r = findByName(reviews, c.name);
    const tiers = m?.tiers || [];
    const stats = tierStats(tiers);
    const price = m ? entryPrice(m) : null;
    const value = c.value_score ?? null;
    return {
      name: c.name,
      value,
      price,
      rating: r?.rating ?? null,
      sentiment: r?.sentiment || null,
      color: CHART_COLORS[i % CHART_COLORS.length],
      isYou: false,
      tierCount: stats.count,
      priceMax: stats.max,
      coverage: featureCoverage(m, featureCount),
      density: value != null && price > 0 ? Number((value / (price / 100)).toFixed(2)) : null,
    };
  });

  let you = null;
  if (product && (product.value_score != null || (product.tiers || []).length || youMatrix)) {
    const tiers = product.tiers || youMatrix?.tiers || [];
    const stats = tierStats(tiers);
    const price = entryPrice({ tiers });
    const value = product.value_score ?? null;
    you = {
      name: `${product.name} (you)`,
      shortName: product.name,
      value,
      price,
      rating: null,
      sentiment: null,
      color: YOU_COLOR,
      isYou: true,
      priceEstimated: false,
      tierCount: stats.count,
      priceMax: stats.max,
      coverage: featureCoverage({ tiers }, featureCount),
      density: value != null && price > 0 ? Number((value / (price / 100)).toFixed(2)) : null,
    };
  }
  const data = you ? [you, ...comp] : comp;

  const valueData = data.filter((d) => d.value != null);
  const priceData = data.filter((d) => d.price != null);
  const ratingData = data.filter((d) => d.rating != null);
  const densityData = data.filter((d) => d.density != null).sort((a, b) => b.density - a.density);
  const tierData = data.filter((d) => d.tierCount > 0);
  const coverageData = data.filter((d) => d.coverage != null);
  let mapData = data.filter((d) => d.value != null && d.price != null);

  if (you?.value != null && you.price == null && priceData.some((d) => !d.isYou)) {
    const proxy = Math.min(...priceData.filter((d) => !d.isYou).map((d) => d.price));
    mapData = [...mapData, { ...you, price: proxy, priceEstimated: true }];
  }

  mapData = spreadMapPoints(mapData.map((d, i) => ({ ...d, labelIndex: i })));
  const domains = mapDomains(mapData.length ? mapData : [{ price: you?.price || 100, value: you?.value || 5 }]);
  const avgPrice = priceData.length ? priceData.reduce((s, d) => s + d.price, 0) / priceData.length : null;
  const avgValue = valueData.length ? valueData.reduce((s, d) => s + d.value, 0) / valueData.length : null;
  const rivalPrices = priceData.filter((d) => !d.isYou);
  const rivalValues = valueData.filter((d) => !d.isYou);

  const scored = competitors.filter((c) => c.value_score != null).length;
  const priced = comp.filter((c) => c.price != null).length;
  const reviewed = comp.filter((c) => c.rating != null || c.sentiment).length;

  // Your plan ladder for the tier strip
  const yourTiers = (product?.tiers || youMatrix?.tiers || [])
    .filter((t) => t?.name)
    .map((t) => ({
      name: t.name,
      price: typeof t.price_monthly === 'number' ? t.price_monthly : null,
    }));

  const insights = [];
  if (you?.value != null && rivalValues.length) {
    const better = rivalValues.filter((d) => d.value < you.value).length;
    insights.push(`You outscore ${better}/${rivalValues.length} rivals on value.`);
  }
  if (you?.price != null && rivalPrices.length) {
    const cheaper = rivalPrices.filter((d) => d.price > you.price).length;
    const pct = avgPrice ? Math.round(((you.price - avgPrice) / avgPrice) * 100) : null;
    if (pct != null) {
      insights.push(pct === 0
        ? 'Your entry price matches the field average.'
        : pct > 0
          ? `Your entry price is ${pct}% above the field average.`
          : `Your entry price is ${Math.abs(pct)}% below the field average.`);
    } else {
      insights.push(`Cheaper than ${cheaper}/${rivalPrices.length} rivals at entry.`);
    }
  }
  if (you?.coverage != null && coverageData.filter((d) => !d.isYou).length) {
    const avgCov = coverageData.filter((d) => !d.isYou).reduce((s, d) => s + d.coverage, 0)
      / coverageData.filter((d) => !d.isYou).length;
    insights.push(`Feature coverage ${you.coverage}% vs rivals’ ~${Math.round(avgCov)}%.`);
  }
  if (!rivalValues.length && !rivalPrices.length) {
    insights.push('Competitor bars fill in as scores and pricing land.');
  }

  if (!valueData.length && !priceData.length && !yourTiers.length && !competitors.length) return null;

  const barH = (n) => Math.max(140, Math.min(280, n * 36 + 40));

  return (
    <ReportSection
      icon="bar"
      title="Visual analysis"
      skills={[{ skill: 'you-contents' }, { skill: 'you-research' }, { skill: 'grok' }]}
    >
      {/* KPI strip */}
      <div className="mb-4 grid gap-2 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile
          label="Your value"
          value={you?.value != null ? `${you.value}/10` : '—'}
          sub={avgValue != null ? `Field avg ${avgValue.toFixed(1)}` : 'Awaiting score'}
          accent
        />
        <StatTile
          label="Your entry"
          value={you?.price != null ? `$${Math.round(you.price)}` : '—'}
          sub={avgPrice != null ? `Field avg $${Math.round(avgPrice)}` : 'per month'}
          accent
        />
        <StatTile
          label="Value density"
          value={you?.density != null ? you.density : '—'}
          sub="value pts / $100"
        />
        <StatTile
          label="Plan tiers"
          value={you?.tierCount || yourTiers.length || '—'}
          sub={you?.priceMax != null ? `up to $${Math.round(you.priceMax)}` : 'on your ladder'}
        />
        <StatTile
          label="Feature coverage"
          value={you?.coverage != null ? `${you.coverage}%` : featureCount ? '…' : '—'}
          sub={featureCount ? `${featureCount} features tracked` : 'Run matrix for %'}
        />
        <StatTile
          label="Field coverage"
          value={`${scored}/${competitors.length}`}
          sub={`${priced} priced · ${reviewed} reviewed`}
        />
      </div>

      {insights.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {insights.map((t) => (
            <span key={t} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Positioning map — show with 1+ points; placeholder when waiting on rivals */}
      <div className="mb-4">
        <ChartCard
          title="Positioning map"
          hint={mapData.length >= 2
            ? 'Entry price vs. value — top-left is best value, bottom-right is overpriced. You are the pink star (★).'
            : 'Map unlocks when at least two products have both a value score and an entry price.'}
        >
          {mapData.length >= 1 ? (
            <>
              <ResponsiveContainer width="100%" height={mapData.length >= 2 ? 300 : 220}>
                <ScatterChart margin={{ top: 28, right: 24, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke="#181c24" />
                  <XAxis
                    type="number"
                    dataKey="price"
                    name="Entry price"
                    domain={domains.x}
                    tick={AXIS}
                    tickFormatter={(v) => `$${Math.round(v)}`}
                    label={{ value: 'Entry price ($/mo)', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="value"
                    name="Value"
                    domain={domains.y}
                    tick={AXIS}
                    label={{ value: 'Value score', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                  />
                  <ZAxis range={[90, 90]} />
                  {avgPrice != null && domains.x[0] <= avgPrice && avgPrice <= domains.x[1] && (
                    <ReferenceLine x={avgPrice} stroke="#2c3340" strokeDasharray="4 4" />
                  )}
                  {domains.y[0] <= 5 && domains.y[1] >= 5 && (
                    <ReferenceLine y={5} stroke="#2c3340" strokeDasharray="4 4" />
                  )}
                  <Tooltip content={<MapTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    data={mapData}
                    shape={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload?.isYou) {
                        return (
                          <polygon
                            points={`${cx},${cy - 9} ${cx + 2.5},${cy - 3} ${cx + 8},${cy - 3} ${cx + 3.5},${cy + 1} ${cx + 5.5},${cy + 7} ${cx},${cy + 4} ${cx - 5.5},${cy + 7} ${cx - 3.5},${cy + 1} ${cx - 8},${cy - 3} ${cx - 2.5},${cy - 3}`}
                            fill={YOU_COLOR}
                            stroke="#fff"
                            strokeWidth={1}
                          />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={6} fill={payload?.color || '#818cf8'} stroke="#0e1014" strokeWidth={1.5} />;
                    }}
                  >
                    {mapData.map((d, i) => (
                      <Cell key={i} fill={d.isYou ? YOU_COLOR : d.color} />
                    ))}
                    <LabelList dataKey="name" content={<MapPointLabel />} />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ink-800 pt-3">
                {mapData.map((d) => (
                  <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: d.isYou ? YOU_COLOR : d.color }}
                    />
                    {truncateLabel(d.name, 22)}
                    {d.priceEstimated && <span className="text-slate-600">(est. price)</span>}
                  </span>
                ))}
                {competitors.length > mapData.filter((d) => !d.isYou).length && (
                  <span className="text-[11px] text-slate-600">
                    +{competitors.length - mapData.filter((d) => !d.isYou).length} rivals still landing…
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
              Waiting on value scores and entry prices to plot the map.
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {valueData.length > 0 && (
          <ChartCard title="Value-for-money" hint="AI score out of 10.">
            <ResponsiveContainer width="100%" height={barH(valueData.length)}>
              <BarChart data={valueData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} tick={AXIS} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS} tickFormatter={(v) => truncateLabel(v, 14)} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`${v}/10`, 'Value']} />
                {avgValue != null && <ReferenceLine x={avgValue} stroke="#475569" strokeDasharray="3 3" />}
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {valueData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="value" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {priceData.length > 0 && (
          <ChartCard title="Entry pricing" hint="Lowest paid plan, $/month.">
            <ResponsiveContainer width="100%" height={barH(priceData.length)}>
              <BarChart data={priceData} layout="vertical" margin={{ left: 8, right: 36 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" tick={AXIS} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS} tickFormatter={(v) => truncateLabel(v, 14)} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`$${v}/mo`, 'Entry']} />
                {avgPrice != null && <ReferenceLine x={avgPrice} stroke="#475569" strokeDasharray="3 3" />}
                <Bar dataKey="price" radius={[0, 4, 4, 0]}>
                  {priceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="price" position="right" formatter={(v) => `$${v}`} style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {densityData.length > 0 && (
          <ChartCard title="Value density" hint="Value points earned per $100 of entry price — higher is better bargain.">
            <ResponsiveContainer width="100%" height={barH(densityData.length)}>
              <BarChart data={densityData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" tick={AXIS} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS} tickFormatter={(v) => truncateLabel(v, 14)} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [v, 'Density']} />
                <Bar dataKey="density" radius={[0, 4, 4, 0]}>
                  {densityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="density" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {coverageData.length > 0 && (
          <ChartCard title="Feature coverage" hint="% of tracked features present on the lowest paid plan.">
            <ResponsiveContainer width="100%" height={barH(coverageData.length)}>
              <BarChart data={coverageData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS} tickFormatter={(v) => truncateLabel(v, 14)} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`${v}%`, 'Coverage']} />
                <Bar dataKey="coverage" radius={[0, 4, 4, 0]}>
                  {coverageData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="coverage" position="right" formatter={(v) => `${v}%`} style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {tierData.length > 0 && (
          <ChartCard title="Plan breadth" hint="How many paid tiers each product publishes.">
            <ResponsiveContainer width="100%" height={barH(tierData.length)}>
              <BarChart data={tierData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS} tickFormatter={(v) => truncateLabel(v, 14)} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [v, 'Tiers']} />
                <Bar dataKey="tierCount" radius={[0, 4, 4, 0]}>
                  {tierData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="tierCount" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {ratingData.length > 0 && (
          <ChartCard title="Customer ratings" hint="Public review averages out of 5 when available.">
            <ResponsiveContainer width="100%" height={barH(ratingData.length)}>
              <BarChart data={ratingData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={AXIS} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS} tickFormatter={(v) => truncateLabel(v, 14)} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`${v}/5`, 'Rating']} />
                <Bar dataKey="rating" radius={[0, 4, 4, 0]} fill="#fbbf24">
                  <LabelList dataKey="rating" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Your pricing ladder */}
      {yourTiers.length > 0 && (
        <div className="mt-4">
          <ChartCard title="Your pricing ladder" hint="Published plans for your product — useful while rival bars are still filling in.">
            <div className="flex flex-wrap gap-2">
              {yourTiers.map((t, i) => {
                const maxP = Math.max(...yourTiers.map((x) => x.price || 0), 1);
                const width = t.price != null ? Math.max(18, Math.round((t.price / maxP) * 100)) : 18;
                return (
                  <div key={`${t.name}-${i}`} className="min-w-[7rem] flex-1 rounded-lg border border-accent/25 bg-accent/5 p-3">
                    <p className="text-xs font-medium text-accent-soft">{t.name}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">
                      {t.price != null ? `$${t.price}` : '—'}
                      {t.price != null && <span className="text-xs font-normal text-slate-500">/mo</span>}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full bg-accent-soft/80" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      )}

      {/* Field roster / coverage checklist */}
      {competitors.length > 0 && (
        <div className="mt-4">
          <ChartCard title="Field roster" hint="What’s landed so far for each competitor.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-ink-700 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Competitor</th>
                    <th className="px-2 py-2 font-medium">Value</th>
                    <th className="px-2 py-2 font-medium">Entry</th>
                    <th className="px-2 py-2 font-medium">Tiers</th>
                    <th className="px-2 py-2 font-medium">Features</th>
                    <th className="px-2 py-2 font-medium">Reviews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {you && (
                    <tr className="bg-accent/5">
                      <td className="py-2 pr-3 font-medium text-accent-soft">{you.shortName || you.name} <span className="text-[10px]">(you)</span></td>
                      <td className="px-2 py-2 tabular-nums text-slate-200">{you.value ?? '—'}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-200">{you.price != null ? `$${Math.round(you.price)}` : '—'}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-200">{you.tierCount || '—'}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-200">{you.coverage != null ? `${you.coverage}%` : '—'}</td>
                      <td className="px-2 py-2 text-slate-500">—</td>
                    </tr>
                  )}
                  {comp.map((c) => (
                    <tr key={c.name}>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-200">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                          {c.name}
                        </span>
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-300">{c.value ?? <span className="text-slate-600">…</span>}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-300">{c.price != null ? `$${Math.round(c.price)}` : <span className="text-slate-600">…</span>}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-300">{c.tierCount || <span className="text-slate-600">…</span>}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-300">{c.coverage != null ? `${c.coverage}%` : <span className="text-slate-600">…</span>}</td>
                      <td className="px-2 py-2 text-slate-300">
                        {c.rating != null ? `${c.rating}/5` : c.sentiment || <span className="text-slate-600">…</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}
    </ReportSection>
  );
}

function StarRating({ value }) {
  if (value == null) return <span className="text-xs text-slate-600">no rating</span>;
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? 'text-amber-400' : 'text-ink-600'}>★</span>
      ))}
      <span className="ml-1 text-xs text-slate-400">{value}/5</span>
    </span>
  );
}

function ReviewsSection({ reviews }) {
  const withData = reviews.filter((r) => r.sentiment);
  const rated = reviews.filter((r) => typeof r.rating === 'number');
  const avgRating = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length) : null;
  const counts = { positive: 0, mixed: 0, negative: 0 };
  for (const r of withData) counts[r.sentiment] = (counts[r.sentiment] || 0) + 1;

  return (
    <ReportSection icon="users" title="Voice of the customer" skills={[{ skill: 'you-research' }]}>
      {withData.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-700 p-4 text-center text-sm text-slate-500">
          No public review data was found for these competitors.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{avgRating != null ? avgRating.toFixed(1) : '—'}</p>
              <p className="text-xs text-slate-500">avg rating / 5</p>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{counts.positive}</p>
              <p className="text-xs text-slate-500">positively reviewed</p>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-center">
              <p className="text-2xl font-bold text-rose-400">{counts.negative}</p>
              <p className="text-xs text-slate-500">negatively reviewed</p>
            </div>
          </div>

          {rated.length >= 2 && (
            <div className="mb-4">
              <ChartCard title="Customer rating comparison" hint="Average star rating out of 5.">
                <ResponsiveContainer width="100%" height={Math.max(150, rated.length * 36)}>
                  <BarChart data={rated.map((r, i) => ({ name: r.name, rating: r.rating, color: CHART_COLORS[i % CHART_COLORS.length] }))}
                    layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid stroke="#181c24" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} tick={AXIS} />
                    <YAxis type="category" dataKey="name" width={90} tick={AXIS} />
                    <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`${v}/5`, 'Rating']} />
                    <Bar dataKey="rating" radius={[0, 4, 4, 0]} fill="#fbbf24">
                      <LabelList dataKey="rating" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id ?? r.name} className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{r.name}</span>
                  <div className="flex items-center gap-3">
                    <StarRating value={r.rating} />
                    {r.sentiment && <SentimentChip sentiment={r.sentiment} />}
                  </div>
                </div>
                {r.summary && <p className="mt-2 text-sm text-slate-300">“{r.summary}”</p>}
                {(r.pros?.length || r.cons?.length) ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {r.pros?.length > 0 && (
                      <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">What users love</p>
                        <ul className="space-y-1">{r.pros.map((p, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-slate-300"><span className="text-emerald-500">+</span>{p}</li>
                        ))}</ul>
                      </div>
                    )}
                    {r.cons?.length > 0 && (
                      <div className="rounded-lg border border-rose-900/30 bg-rose-950/10 p-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-500">Common complaints</p>
                        <ul className="space-y-1">{r.cons.map((c, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-slate-300"><span className="text-rose-500">−</span>{c}</li>
                        ))}</ul>
                      </div>
                    )}
                  </div>
                ) : !r.sentiment ? (
                  <p className="mt-1 text-xs text-slate-600">No review data found.</p>
                ) : null}
                <SourceAttribution
                  attribution={r.attribution}
                  sources={r.sources}
                  skill={r.skill || 'you-research'}
                  skillLabel={r.skillLabel || 'You.com Research'}
                  compact
                />
              </div>
            ))}
          </div>
        </>
      )}
    </ReportSection>
  );
}

function StrategySection({ strategy, productName }) {
  const swot = strategy.swot || {};
  const positioning = strategy.positioning || [];
  const quadrants = [
    { key: 'strengths', label: 'Strengths', color: 'emerald', sign: '+' },
    { key: 'weaknesses', label: 'Weaknesses', color: 'rose', sign: '−' },
    { key: 'opportunities', label: 'Opportunities', color: 'accent', sign: '↗' },
    { key: 'threats', label: 'Threats', color: 'amber', sign: '!' },
  ];
  const tone = {
    emerald: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-400',
    rose: 'border-rose-900/40 bg-rose-950/10 text-rose-400',
    accent: 'border-accent/30 bg-accent/5 text-accent-soft',
    amber: 'border-amber-900/40 bg-amber-950/10 text-amber-400',
  };
  const hasSwot = quadrants.some((q) => (swot[q.key] || []).length);

  return (
    <ReportSection icon="shield" title="Strategy" skills={[{ skill: 'you-contents' }, { skill: 'grok' }]}>
      {hasSwot && (
        <>
          <p className="mb-3 text-xs text-slate-500">
            SWOT for <span className="text-slate-300">{productName || 'your product'}</span> against this competitive set.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {quadrants.map((q) => (
              <div key={q.key} className={`rounded-lg border p-3 ${tone[q.color]}`}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide">{q.label}</p>
                <ul className="space-y-1">
                  {(swot[q.key] || []).map((item, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-slate-300">
                      <span className="shrink-0">{q.sign}</span>{item}
                    </li>
                  ))}
                  {(swot[q.key] || []).length === 0 && <li className="text-xs text-slate-600">—</li>}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {positioning.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">How each competitor positions itself</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-slate-500">Competitor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Positioning</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Targets</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">Messaging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {positioning.map((p, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-4 text-sm font-medium text-white">{p.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{p.positioning || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{p.target_audience || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{p.messaging_angle || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportSection>
  );
}

function MarketSection({ market }) {
  const history = (market.history || []).filter((h) => h.year && typeof h.size_usd_millions === 'number');
  const companies = (market.companies || []).filter((c) => c.name);
  const distribution = market.distribution;
  const pulse = market.pulse;
  const syndicated = market.syndicated;
  const shareItems = (distribution?.items || []).slice(0, 10);
  const isTriangulated = distribution?.method === 'triangulated';

  const hintForMethod = {
    triangulated: 'Blends estimated revenue, web traffic, and review activity — directional, not syndicated market share.',
    revenue_implied: 'Estimated revenue as a share of category TAM — directional, not syndicated market share.',
    relative_revenue: 'Relative revenue scale among tracked competitors (build a market model for TAM-based shares).',
  };

  return (
    <ReportSection icon="trending" title="Market intelligence" skills={[{ skill: 'you-finance' }]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <DistributionMetaChips distribution={distribution} trafficMeta={market.signals?.traffic_meta} compact />
        <Link href="/distribution" className="text-xs text-accent-soft hover:underline">Open distribution →</Link>
      </div>

      <PulseBanner pulse={pulse} limit={4} compact />
      {/* Market size + CAGR */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {market.size_current && (
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <p className="text-xs text-slate-500">Market size</p>
            <p className="text-lg font-bold text-white">{market.size_current}</p>
          </div>
        )}
        {market.cagr && (
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <p className="text-xs text-slate-500">Growth</p>
            <p className="text-lg font-bold text-emerald-400">{market.cagr}</p>
          </div>
        )}
      </div>

      {/* Market-size timeline */}
      {history.length >= 2 && (
        <div className="mb-4">
          <ChartCard title="Market size over time" hint="Estimated total market size ($M).">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history} margin={{ left: 4, right: 16, top: 8 }}>
                <CartesianGrid stroke="#181c24" />
                <XAxis dataKey="year" tick={AXIS} />
                <YAxis tick={AXIS} tickFormatter={(v) => `$${v}M`} />
                <Tooltip contentStyle={TIP_STYLE} formatter={(v) => [`$${v}M`, 'Market size']} />
                <Line type="monotone" dataKey="size_usd_millions" stroke="#818cf8" strokeWidth={2}
                  dot={{ r: 3, fill: '#818cf8' }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {market.summary && <p className="mb-4 text-sm text-slate-400 leading-relaxed">{market.summary}</p>}

      {(syndicated?.table?.rows?.length || syndicated?.vendors?.length) > 0 && (
        <div className="mb-4 rounded-xl border border-ink-700 bg-ink-850 p-4">
          <h3 className="text-sm font-semibold text-white">Published market share</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">From public analyst sources — not blended into estimates</p>
          <div className="mt-3">
            <SyndicatedShareTable syndicated={syndicated} compact />
          </div>
        </div>
      )}

      {shareItems.length > 0 && (
        <div className="mb-4">
          <ChartCard
            title={isTriangulated ? 'Triangulated market presence' : 'Estimated market presence'}
            hint={hintForMethod[distribution.method] || hintForMethod.relative_revenue}
          >
            <PresenceChart distribution={distribution} limit={10} barHeight="h-2.5" nameWidth="w-28" />
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              {isTriangulated && (
                <span className="chip border-indigo-500/30 bg-indigo-500/10 text-indigo-300">Triangulated</span>
              )}
              {distribution.cr4_pct != null && (
                <span className="chip border-ink-700 bg-ink-850">Top 4 ≈ {distribution.cr4_pct}% presence</span>
              )}
              {distribution.remainder_pct != null && distribution.remainder_pct > 0 && distribution.method === 'revenue_implied' && (
                <span className="chip border-ink-700 bg-ink-850">Untracked / remainder ≈ {distribution.remainder_pct}%</span>
              )}
              {distribution.tam_source === 'market_model' && (
                <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">TAM from market model</span>
              )}
              {market.signals?.traffic_meta?.research > 0 && (
                <span className="chip border-ink-700 bg-ink-850">Traffic signals: {market.signals.traffic_meta.research}</span>
              )}
            </div>
          </ChartCard>
        </div>
      )}

      {/* Company financials */}
      {companies.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <div key={c.name} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <p className="text-sm font-semibold text-white">{c.name}</p>
              <div className="mt-2 space-y-1 text-xs">
                {c.funding && c.funding !== 'null' && <Row label="Funding" value={c.funding} />}
                {c.revenue && c.revenue !== 'null' && <Row label="Revenue" value={c.revenue} />}
                {c.valuation && c.valuation !== 'null' && <Row label="Valuation" value={c.valuation} />}
                {c.share_pct != null && (
                  <Row
                    label="Est. presence"
                    value={`${c.presence_pct ?? c.share_pct}%${c.share_method === 'relative_revenue' ? ' (relative)' : ''}`}
                  />
                )}
              </div>
              {c.note && <p className="mt-2 text-xs text-slate-500">{c.note}</p>}
            </div>
          ))}
        </div>
      )}

      {market.narrative && <div className="mt-4"><Prose text={market.narrative} /></div>}

      <SourceAttribution
        attribution={market.attribution}
        sources={market.sources}
        skill={market.skill || 'you-finance'}
        skillLabel={market.skillLabel || 'You.com Finance'}
      />
    </ReportSection>
  );
}


function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */
export function ReportSection({ icon, title, children, skills, skill, skillLabel }) {
  const layout = useContext(ReportLayoutCtx);
  const skillProps = skills?.length
    ? { skills }
    : (skill ? { skill, skillLabel } : null);
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {layout !== 'tabs' ? (
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Icon name={icon} className="h-4 w-4 text-accent-soft" /> {title}
          </h3>
        ) : (
          <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
        )}
        {skillProps && <SkillChipRow {...skillProps} size="md" />}
      </div>
      {children}
    </div>
  );
}

function SentimentChip({ sentiment }) {
  const styles = {
    positive: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-400',
    mixed: 'border-amber-800/50 bg-amber-950/30 text-amber-400',
    negative: 'border-rose-800/50 bg-rose-950/30 text-rose-400',
  };
  return <span className={`chip text-[10px] ${styles[sentiment] || styles.mixed}`}>{sentiment}</span>;
}

function Prose({ text }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (/^\*\*(.+)\*\*$/.test(line.trim())) {
          return <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-slate-200">{line.trim().replace(/\*\*/g, '')}</h4>;
        }
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return <li key={i} className="ml-4 list-disc text-sm text-slate-400">{line.trim().replace(/^[-•]\s/, '')}</li>;
        }
        return line.trim() ? <p key={i} className="text-sm text-slate-400 leading-relaxed">{line}</p> : null;
      })}
    </div>
  );
}
