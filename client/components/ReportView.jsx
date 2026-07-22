'use client';

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { Icon, ValueScore } from './ui';
import Link from 'next/link';
import {
  CHART_COLORS,
  DistributionMetaChips,
  PresenceChart,
  PulseBanner,
  SyndicatedShareTable,
} from './distribution/DistributionShared';
const TIP_STYLE = { background: '#0e1014', border: '1px solid #181c24', borderRadius: 8, fontSize: 12 };
const AXIS = { fill: '#64748b', fontSize: 11 };

/**
 * Renders a full competitive report from data.
 * Props: { competitors, matrix, positioning, reviews, take }
 * Works for both the live analysis and a saved report snapshot.
 */
export default function ReportView({ competitors = [], matrix, positioning, reviews, take, market, product, strategy }) {
  const youName = (product?.name || matrix?.productName || '').toLowerCase();
  return (
    <div className="space-y-8">
      {(product?.icp || product?.business_model || strategy?.icp || strategy?.business_model) && (
        <ReportSection icon="users" title="Who you serve & how you make money">
          <div className="grid gap-3 sm:grid-cols-2">
            {(product?.icp || strategy?.icp) && (
              <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">ICP</p>
                <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">{product?.icp || strategy?.icp}</p>
              </div>
            )}
            {(product?.business_model || strategy?.business_model) && (
              <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Business model</p>
                <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">{product?.business_model || strategy?.business_model}</p>
              </div>
            )}
          </div>
        </ReportSection>
      )}

      <ChartsSection competitors={competitors} matrix={matrix} reviews={reviews} product={product} />

      {market && <MarketSection market={market} />}

      {(matrix?.competitors?.length > 0 || product?.tiers?.length > 0) && (
        <ReportSection icon="card" title="Pricing & plans">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product?.tiers?.length > 0 && <PricingCard name={product.name} tiers={product.tiers} you />}
            {(matrix?.competitors || [])
              .filter((c) => (c.name || '').toLowerCase() !== youName)
              .map((c) => <PricingCard key={c.name} name={c.name} tiers={c.tiers} />)}
          </div>
        </ReportSection>
      )}

      {matrix?.features?.length > 0 && (
        <ReportSection icon="grid" title="Feature matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-ink-soft">Feature</th>
                  {matrix.competitors.map((c) => {
                    const isYou = (c.name || '').toLowerCase() === youName;
                    return (
                      <th key={c.name} className={`px-3 py-2 text-center text-xs font-medium ${isYou ? 'text-accent' : 'text-ink-soft'}`}>
                        {c.name}{isYou && <span className="block text-[9px] font-normal text-accent/70">you</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {matrix.features.map((f, fi) => (
                  <tr key={fi}>
                    <td className="py-2 pr-4 text-xs text-ink-soft">{f}</td>
                    {matrix.competitors.map((c) => {
                      const isYou = (c.name || '').toLowerCase() === youName;
                      const has = c.tiers?.[0]?.features?.[fi];
                      return (
                        <td key={c.name} className={`px-3 py-2 text-center ${isYou ? 'bg-accent/5' : ''}`}>
                          {has === true ? <Icon name="check" className="mx-auto h-3.5 w-3.5 text-emerald-700" />
                            : has === false ? <Icon name="x" className="mx-auto h-3.5 w-3.5 text-ink-faint" />
                            : <span className="text-ink-faint">–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>
      )}

      <ReportSection icon="trending" title="Business value">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {product && (product.value_score != null || product.value_analysis) && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-accent">{product.name} <span className="text-[10px] font-normal">(you)</span></span>
                <ValueScore score={product.value_score} />
              </div>
              {product.value_analysis && <p className="mt-1 text-xs text-ink-soft line-clamp-3">{product.value_analysis}</p>}
            </div>
          )}
          {competitors.map((c) => (
            <div key={c.id ?? c.name} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{c.name}</span>
                <ValueScore score={c.value_score} />
              </div>
              {c.value_analysis && <p className="mt-1 text-xs text-ink-soft line-clamp-3">{c.value_analysis}</p>}
            </div>
          ))}
        </div>
        {positioning && <Prose text={positioning} />}
      </ReportSection>

      {reviews && <ReviewsSection reviews={reviews} />}

      {strategy && <StrategySection strategy={strategy} productName={product?.name} />}

      {take && (
        <ReportSection icon="sparkle" title="Analyst take">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4"><Prose text={take} /></div>
        </ReportSection>
      )}
    </div>
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
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mb-2 text-xs text-ink-soft">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PricingCard({ name, tiers, you }) {
  return (
    <div className={`rounded-lg border p-3 ${you ? 'border-accent/40 bg-accent/5' : 'border-ink-700 bg-ink-850'}`}>
      <p className={`text-sm font-semibold ${you ? 'text-accent' : 'text-ink'}`}>
        {name}{you && <span className="text-[10px] font-normal"> (you)</span>}
      </p>
      <div className="mt-2 space-y-1.5">
        {(tiers || []).length === 0 && <p className="text-xs text-ink-faint">No pricing extracted</p>}
        {(tiers || []).map((t, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{t.name}</span>
            <span className="font-medium text-ink">{t.price_monthly != null ? `$${t.price_monthly}/mo` : '—'}</span>
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
    <div style={TIP_STYLE} className="px-3 py-2 text-xs text-ink">
      <p className="font-semibold text-ink">{d.name}</p>
      <p className="mt-1 text-ink-soft">Value: {d.value ?? '—'}/10</p>
      <p className="text-ink-soft">
        Entry: {d.price != null ? `$${Math.round(d.price)}/mo` : '—'}
        {d.priceEstimated ? ' (estimated)' : ''}
      </p>
    </div>
  );
}

function ChartsSection({ competitors, matrix, reviews, product }) {
  const comp = competitors.map((c, i) => {
    const m = findByName(matrix?.competitors, c.name);
    const r = findByName(reviews, c.name);
    return {
      name: c.name,
      value: c.value_score ?? null,
      price: m ? entryPrice(m) : null,
      rating: r?.rating ?? null,
      color: CHART_COLORS[i % CHART_COLORS.length],
      isYou: false,
    };
  });

  // Your own product as a highlighted entry.
  let you = null;
  if (product && (product.value_score != null || (product.tiers || []).length)) {
    you = {
      name: `${product.name} (you)`,
      value: product.value_score ?? null,
      price: entryPrice(product),
      color: YOU_COLOR,
      isYou: true,
      priceEstimated: false,
    };
  }
  const data = you ? [you, ...comp] : comp;

  const valueData = data.filter((d) => d.value != null);
  const priceData = data.filter((d) => d.price != null);
  let mapData = data.filter((d) => d.value != null && d.price != null);

  // If we have a value score but no extracted price, place "you" near the value
  // cluster using the cheapest competitor entry as a proxy (tooltip marks it estimated).
  if (you?.value != null && you.price == null && priceData.length) {
    const proxy = Math.min(...priceData.filter((d) => !d.isYou).map((d) => d.price));
    mapData = [
      ...mapData,
      { ...you, price: proxy, priceEstimated: true },
    ];
  }

  mapData = spreadMapPoints(mapData.map((d, i) => ({ ...d, labelIndex: i })));
  const domains = mapDomains(mapData);
  const avgPrice = priceData.length ? priceData.reduce((s, d) => s + d.price, 0) / priceData.length : null;

  if (!valueData.length && !priceData.length) return null;

  return (
    <ReportSection icon="bar" title="Visual analysis">
      {mapData.length >= 2 && (
        <div className="mb-4">
          <ChartCard title="Positioning map" hint="Entry price vs. value score — top-left is best value, bottom-right is overpriced. Your product is the pink star (★).">
            <ResponsiveContainer width="100%" height={320}>
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
                    return <circle cx={cx} cy={cy} r={6} fill={payload?.color || '#5C6B52'} stroke="#0e1014" strokeWidth={1.5} />;
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
                <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: d.isYou ? YOU_COLOR : d.color }}
                  />
                  {truncateLabel(d.name, 22)}
                  {d.priceEstimated && <span className="text-ink-faint">(est. price)</span>}
                </span>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {valueData.length > 0 && (
          <ChartCard title="Value-for-money" hint="AI score out of 10.">
            <ResponsiveContainer width="100%" height={Math.max(160, valueData.length * 38)}>
              <BarChart data={valueData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} tick={AXIS} />
                <YAxis type="category" dataKey="name" width={90} tick={AXIS} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`${v}/10`, 'Value']} />
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
            <ResponsiveContainer width="100%" height={Math.max(160, priceData.length * 38)}>
              <BarChart data={priceData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke="#181c24" horizontal={false} />
                <XAxis type="number" tick={AXIS} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={90} tick={AXIS} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: '#13161c' }} formatter={(v) => [`$${v}/mo`, 'Entry']} />
                <Bar dataKey="price" radius={[0, 4, 4, 0]}>
                  {priceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="price" position="right" formatter={(v) => `$${v}`} style={{ fill: '#94a3b8', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </ReportSection>
  );
}

function StarRating({ value }) {
  if (value == null) return <span className="text-xs text-ink-faint">no rating</span>;
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? 'text-amber-700' : 'text-ink-600'}>★</span>
      ))}
      <span className="ml-1 text-xs text-ink-soft">{value}/5</span>
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
    <ReportSection icon="users" title="Voice of the customer">
      {withData.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-700 p-4 text-center text-sm text-ink-soft">
          No public review data was found for these competitors.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{avgRating != null ? avgRating.toFixed(1) : '—'}</p>
              <p className="text-xs text-ink-soft">avg rating / 5</p>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{counts.positive}</p>
              <p className="text-xs text-ink-soft">positively reviewed</p>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-center">
              <p className="text-2xl font-bold text-rose-700">{counts.negative}</p>
              <p className="text-xs text-ink-soft">negatively reviewed</p>
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
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                  <div className="flex items-center gap-3">
                    <StarRating value={r.rating} />
                    {r.sentiment && <SentimentChip sentiment={r.sentiment} />}
                  </div>
                </div>
                {r.summary && <p className="mt-2 text-sm text-ink-soft">“{r.summary}”</p>}
                {(r.pros?.length || r.cons?.length) ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {r.pros?.length > 0 && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">What users love</p>
                        <ul className="space-y-1">{r.pros.map((p, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-ink-soft"><span className="text-emerald-500">+</span>{p}</li>
                        ))}</ul>
                      </div>
                    )}
                    {r.cons?.length > 0 && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-500">Common complaints</p>
                        <ul className="space-y-1">{r.cons.map((c, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-ink-soft"><span className="text-rose-500">−</span>{c}</li>
                        ))}</ul>
                      </div>
                    )}
                  </div>
                ) : !r.sentiment ? (
                  <p className="mt-1 text-xs text-ink-faint">No review data found.</p>
                ) : null}
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
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    accent: 'border-accent/30 bg-accent/5 text-accent',
    amber: 'border-amber-900/40 bg-amber-950/10 text-amber-700',
  };
  const hasSwot = quadrants.some((q) => (swot[q.key] || []).length);

  return (
    <ReportSection icon="shield" title="Strategy">
      {hasSwot && (
        <>
          <p className="mb-3 text-xs text-ink-soft">
            SWOT for <span className="text-ink-soft">{productName || 'your product'}</span> against this competitive set.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {quadrants.map((q) => (
              <div key={q.key} className={`rounded-lg border p-3 ${tone[q.color]}`}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide">{q.label}</p>
                <ul className="space-y-1">
                  {(swot[q.key] || []).map((item, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-ink-soft">
                      <span className="shrink-0">{q.sign}</span>{item}
                    </li>
                  ))}
                  {(swot[q.key] || []).length === 0 && <li className="text-xs text-ink-faint">—</li>}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {positioning.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">How each competitor positions itself</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-ink-soft">Competitor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-ink-soft">Positioning</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-ink-soft">Targets</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-ink-soft">Messaging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {positioning.map((p, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-4 text-sm font-medium text-ink">{p.name}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{p.positioning || '—'}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{p.target_audience || '—'}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{p.messaging_angle || '—'}</td>
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
    <ReportSection icon="trending" title="Market intelligence">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <DistributionMetaChips distribution={distribution} trafficMeta={market.signals?.traffic_meta} compact />
        <Link href="/distribution" className="text-xs text-accent hover:underline">Open distribution →</Link>
      </div>

      <PulseBanner pulse={pulse} limit={4} compact />
      {/* Market size + CAGR */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {market.size_current && (
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <p className="text-xs text-ink-soft">Market size</p>
            <p className="text-lg font-bold text-ink">{market.size_current}</p>
          </div>
        )}
        {market.cagr && (
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <p className="text-xs text-ink-soft">Growth</p>
            <p className="text-lg font-bold text-emerald-700">{market.cagr}</p>
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
                <Line type="monotone" dataKey="size_usd_millions" stroke="#5C6B52" strokeWidth={2}
                  dot={{ r: 3, fill: '#5C6B52' }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {market.summary && <p className="mb-4 text-sm text-ink-soft leading-relaxed">{market.summary}</p>}

      {(syndicated?.table?.rows?.length || syndicated?.vendors?.length) > 0 && (
        <div className="mb-4 rounded-xl border border-ink-700 bg-ink-850 p-4">
          <h3 className="text-sm font-semibold text-ink">Published market share</h3>
          <p className="mt-0.5 text-[11px] text-ink-soft">From public analyst sources — not blended into estimates</p>
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
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-soft">
              {isTriangulated && (
                <span className="chip border-accent/25 bg-accent-mist text-accent">Triangulated</span>
              )}
              {distribution.cr4_pct != null && (
                <span className="chip border-ink-700 bg-ink-850">Top 4 ≈ {distribution.cr4_pct}% presence</span>
              )}
              {distribution.remainder_pct != null && distribution.remainder_pct > 0 && distribution.method === 'revenue_implied' && (
                <span className="chip border-ink-700 bg-ink-850">Untracked / remainder ≈ {distribution.remainder_pct}%</span>
              )}
              {distribution.tam_source === 'market_model' && (
                <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">TAM from market model</span>
              )}
              {market.signals?.traffic_meta?.apify_fetched > 0 && (
                <span className="chip border-ink-700 bg-ink-850">SimilarWeb: {market.signals.traffic_meta.apify_fetched}</span>
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
              <p className="text-sm font-semibold text-ink">{c.name}</p>
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
              {c.note && <p className="mt-2 text-xs text-ink-soft">{c.note}</p>}
            </div>
          ))}
        </div>
      )}

      {market.narrative && <div className="mt-4"><Prose text={market.narrative} /></div>}

      {market.sources?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {market.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer"
              className="chip border-ink-700 bg-ink-850 text-ink-soft hover:text-accent transition text-[10px]">
              <Icon name="external" className="h-2.5 w-2.5" /> {s.title?.slice(0, 32) || 'source'}
            </a>
          ))}
        </div>
      )}
    </ReportSection>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */
export function ReportSection({ icon, title, children }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name={icon} className="h-4 w-4 text-accent" /> {title}
      </h3>
      {children}
    </div>
  );
}

function SentimentChip({ sentiment }) {
  const styles = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    mixed: 'border-amber-800/50 bg-amber-950/30 text-amber-700',
    negative: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return <span className={`chip text-[10px] ${styles[sentiment] || styles.mixed}`}>{sentiment}</span>;
}

function Prose({ text }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (/^\*\*(.+)\*\*$/.test(line.trim())) {
          return <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-ink">{line.trim().replace(/\*\*/g, '')}</h4>;
        }
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return <li key={i} className="ml-4 list-disc text-sm text-ink-soft">{line.trim().replace(/^[-•]\s/, '')}</li>;
        }
        return line.trim() ? <p key={i} className="text-sm text-ink-soft leading-relaxed">{line}</p> : null;
      })}
    </div>
  );
}
