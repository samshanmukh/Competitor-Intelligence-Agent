'use client';

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { Icon, ValueScore } from './ui';

const CHART_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#f472b6', '#4ade80'];
const TIP_STYLE = { background: '#0e1014', border: '1px solid #181c24', borderRadius: 8, fontSize: 12 };
const AXIS = { fill: '#64748b', fontSize: 11 };

/**
 * Renders a full competitive report from data.
 * Props: { competitors, matrix, positioning, reviews, take }
 * Works for both the live analysis and a saved report snapshot.
 */
export default function ReportView({ competitors = [], matrix, positioning, reviews, take, market }) {
  return (
    <div className="space-y-8">
      <ChartsSection competitors={competitors} matrix={matrix} reviews={reviews} />

      {market && <MarketSection market={market} />}

      {matrix?.competitors?.length > 0 && (
        <ReportSection icon="card" title="Pricing & plans">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matrix.competitors.map((c) => (
              <div key={c.name} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                <p className="text-sm font-semibold text-white">{c.name}</p>
                <div className="mt-2 space-y-1.5">
                  {(c.tiers || []).map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{t.name}</span>
                      <span className="font-medium text-slate-200">{t.price_monthly != null ? `$${t.price_monthly}/mo` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {matrix?.features?.length > 0 && (
        <ReportSection icon="grid" title="Feature matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase text-slate-500">Feature</th>
                  {matrix.competitors.map((c) => (
                    <th key={c.name} className="px-3 py-2 text-center text-xs font-medium text-slate-300">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {matrix.features.map((f, fi) => (
                  <tr key={fi}>
                    <td className="py-2 pr-4 text-xs text-slate-300">{f}</td>
                    {matrix.competitors.map((c) => {
                      const has = c.tiers?.[0]?.features?.[fi];
                      return (
                        <td key={c.name} className="px-3 py-2 text-center">
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
      )}

      <ReportSection icon="trending" title="Business value">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {competitors.map((c) => (
            <div key={c.id ?? c.name} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{c.name}</span>
                <ValueScore score={c.value_score} />
              </div>
              {c.value_analysis && <p className="mt-1 text-xs text-slate-500 line-clamp-3">{c.value_analysis}</p>}
            </div>
          ))}
        </div>
        {positioning && <Prose text={positioning} />}
      </ReportSection>

      {reviews && <ReviewsSection reviews={reviews} />}

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
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChartsSection({ competitors, matrix, reviews }) {
  const data = competitors.map((c, i) => {
    const m = findByName(matrix?.competitors, c.name);
    const r = findByName(reviews, c.name);
    return {
      name: c.name,
      value: c.value_score ?? null,
      price: m ? entryPrice(m) : null,
      rating: r?.rating ?? null,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  const valueData = data.filter((d) => d.value != null);
  const priceData = data.filter((d) => d.price != null);
  const mapData = data.filter((d) => d.value != null && d.price != null);
  const avgPrice = priceData.length ? priceData.reduce((s, d) => s + d.price, 0) / priceData.length : null;

  if (!valueData.length && !priceData.length) return null;

  return (
    <ReportSection icon="bar" title="Visual analysis">
      {mapData.length >= 2 && (
        <div className="mb-4">
          <ChartCard title="Positioning map" hint="Entry price vs. value score — top-left is best value, bottom-right is overpriced.">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid stroke="#181c24" />
                <XAxis type="number" dataKey="price" name="Entry price" unit="$" tick={AXIS}
                  label={{ value: 'Entry price ($/mo)', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 11 }} />
                <YAxis type="number" dataKey="value" name="Value" domain={[0, 10]} tick={AXIS}
                  label={{ value: 'Value score', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <ZAxis range={[120, 120]} />
                {avgPrice != null && <ReferenceLine x={avgPrice} stroke="#2c3340" strokeDasharray="4 4" />}
                <ReferenceLine y={5} stroke="#2c3340" strokeDasharray="4 4" />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v, n) => n === 'Entry price' ? [`$${v}/mo`, n] : [v, n]} />
                <Scatter data={mapData}>
                  {mapData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="name" position="top" style={{ fill: '#cbd5e1', fontSize: 10 }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
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
    <ReportSection icon="users" title="Voice of the customer">
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
              </div>
            ))}
          </div>
        </>
      )}
    </ReportSection>
  );
}

function MarketSection({ market }) {
  const history = (market.history || []).filter((h) => h.year && typeof h.size_usd_millions === 'number');
  const companies = (market.companies || []).filter((c) => c.name);

  return (
    <ReportSection icon="trending" title="Market intelligence">
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
              </div>
              {c.note && <p className="mt-2 text-xs text-slate-500">{c.note}</p>}
            </div>
          ))}
        </div>
      )}

      {market.narrative && <div className="mt-4"><Prose text={market.narrative} /></div>}

      {market.sources?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {market.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer"
              className="chip border-ink-700 bg-ink-850 text-slate-500 hover:text-accent-soft transition text-[10px]">
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
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */
export function ReportSection({ icon, title, children }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon name={icon} className="h-4 w-4 text-accent-soft" /> {title}
      </h3>
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
