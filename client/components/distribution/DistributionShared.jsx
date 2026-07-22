'use client';

import Link from 'next/link';
import { Icon, timeAgo } from '../ui';

export const CHART_COLORS = ['#5C6B52', '#34d399', '#fbbf24', '#fb7185', '#7A8A6E', '#22d3ee', '#f472b6', '#4ade80'];

export const METHOD_HINT = {
  triangulated: 'Blends estimated revenue, web traffic, and review activity — directional, not syndicated share.',
  revenue_implied: 'Estimated revenue as a share of category TAM — directional, not syndicated share.',
  relative_revenue: 'Relative revenue among tracked competitors — build a market model for TAM-based shares.',
};

export const INSIGHT_TONE = {
  amber: 'border-amber-200 bg-amber-50 text-amber-200',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-200',
  indigo: 'border-accent/25 bg-accent-mist text-accent',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  slate: 'border-ink-700 bg-ink-850 text-ink-soft',
};

export function fmtUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

export function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(v)}%`;
}

export function DistributionMetaChips({ distribution, trafficMeta, compact }) {
  if (!distribution) return null;
  const tm = trafficMeta || distribution.traffic_meta;
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-ink-soft ${compact ? '' : 'mt-0'}`}>
      {distribution.captured_at && (
        <span className="chip border-ink-700 bg-ink-850">Updated {timeAgo(distribution.captured_at)}</span>
      )}
      {distribution.method && distribution.method !== 'none' && (
        <span className="chip border-accent/25 bg-accent-mist text-accent capitalize">
          {distribution.method.replace(/_/g, ' ')}
        </span>
      )}
      {distribution.cr4_pct != null && (
        <span className="chip border-ink-700 bg-ink-850">Top 4 ≈ {distribution.cr4_pct}%</span>
      )}
      {distribution.tam_source === 'market_model' && (
        <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">TAM from market model</span>
      )}
      {tm?.apify_fetched > 0 && (
        <span className="chip border-ink-700 bg-ink-850">SimilarWeb: {tm.apify_fetched}</span>
      )}
      {tm?.research > 0 && (
        <span className="chip border-ink-700 bg-ink-850">Research traffic: {tm.research}</span>
      )}
      {tm?.relative > 0 && (
        <span className="chip border-ink-700 bg-ink-850">Relative proxy: {tm.relative}</span>
      )}
    </div>
  );
}

export function InsightGrid({ insights, limit = 4, compact }) {
  const list = (insights || []).slice(0, limit);
  if (!list.length) return null;
  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
      {list.map((ins, i) => (
        <div key={i} className={`rounded-xl border ${compact ? 'p-3' : 'p-4'} ${INSIGHT_TONE[ins.tone] || INSIGHT_TONE.slate}`}>
          <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{ins.title}</p>
          <p className={`mt-1 leading-relaxed opacity-90 ${compact ? 'text-[11px]' : 'text-xs'}`}>{ins.body}</p>
        </div>
      ))}
    </div>
  );
}

export function PulseBanner({ pulse, limit = 6, compact }) {
  if (!pulse?.shifts?.length) return null;
  return (
    <div className={`rounded-xl border border-accent/30 bg-accent/5 ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Market pulse</p>
      <p className={`mt-1 text-ink-soft ${compact ? 'text-xs' : 'text-sm'}`}>{pulse.summary}</p>
      <ul className={`space-y-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
        {pulse.shifts.slice(0, limit).map((s) => (
          <li key={s.name} className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{s.name}</span>
            <span className={s.delta_pct > 0 ? 'text-emerald-700' : 'text-amber-700'}>
              {s.prev_pct}% → {s.next_pct}% ({s.delta_pct > 0 ? '+' : ''}{s.delta_pct}pp)
              {Math.abs(s.delta_pct) >= 5 && ' · significant'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PresenceChart({ distribution, limit = 10, barHeight = 'h-3', nameWidth = 'w-32' }) {
  const items = (distribution?.items || []).slice(0, limit);
  if (!items.length) return null;
  const maxPresence = Math.max(1, ...items.map((i) => i.presence_pct ?? i.share_pct ?? 0));
  const isTriangulated = distribution?.method === 'triangulated';

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = item.presence_pct ?? item.share_pct ?? 0;
        return (
          <div key={item.name}>
            <div className="flex items-center gap-3 text-xs">
              <span className={`${nameWidth} shrink-0 truncate text-ink-soft`}>{item.name}</span>
              <div className={`${barHeight} flex-1 rounded-full bg-ink-800 overflow-hidden`}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(4, (pct / maxPresence) * 100)}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums font-medium text-ink">{pct}%</span>
            </div>
            {isTriangulated && item.signals && (
              <div className="mt-1 flex flex-wrap gap-2 pl-[8.5rem] text-[10px] text-ink-faint">
                {item.signals.revenue != null && <span>Rev {item.signals.revenue}</span>}
                {item.signals.traffic != null && (
                  <span>
                    Traffic {item.signals.traffic}
                    {item.signals.traffic_kind === 'apify' && ' (SW)'}
                    {item.signals.traffic_kind === 'research' && ' (src)'}
                    {item.signals.traffic_kind === 'relative' && ' (est)'}
                  </span>
                )}
                {item.signals.reviews != null && <span>Reviews {item.signals.reviews}</span>}
                {item.share_pct_tam != null && <span>· {item.share_pct_tam}% of TAM</span>}
              </div>
            )}
          </div>
        );
      })}
      {distribution.remainder_pct > 0 && distribution.method === 'revenue_implied' && (
        <p className="text-[11px] text-ink-faint">Untracked / remainder ≈ {distribution.remainder_pct}% of TAM</p>
      )}
      {distribution.disclaimer && (
        <p className="text-[11px] leading-relaxed text-ink-faint">{distribution.disclaimer}</p>
      )}
    </div>
  );
}

export function EstimatedShareTable({ distribution }) {
  const items = distribution?.items || [];
  if (!items.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-800 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            <th className="px-4 py-3">Company</th>
            <th className="px-3 py-3 text-right">Presence</th>
            <th className="px-3 py-3 text-right">TAM share</th>
            <th className="px-3 py-3 text-right">Est. revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {items.map((item) => (
            <tr key={item.name}>
              <td className="px-4 py-2.5 font-medium text-ink">{item.name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                {item.presence_pct ?? item.share_pct ?? '—'}%
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                {item.share_pct_tam != null ? `${item.share_pct_tam}%` : '—'}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtUsd(item.revenue_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CONF_BADGE = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-ink-600 bg-ink-850 text-ink-soft',
};

export function SyndicatedShareTable({ syndicated, compact }) {
  const table = syndicated?.table;
  const rows = table?.rows || [];
  if (!rows.length && !syndicated?.vendors?.length) {
    return (
      <p className={`text-ink-soft ${compact ? 'text-xs' : 'text-sm'}`}>
        No published analyst market share found for this category yet. Estimated presence below is triangulated from your research run.
      </p>
    );
  }

  const displayRows = rows.length ? rows : (syndicated.vendors || []).map((v, i) => ({
    rank: i + 1,
    name: v.name,
    published_share_pct: v.share_pct,
    estimated_presence_pct: null,
    delta_pp: null,
    publisher: v.publisher,
    source_title: v.source_title,
    source_url: v.source_url,
    confidence: v.confidence,
  }));

  return (
    <div>
      {(table?.market_definition || syndicated?.market_definition) && (
        <p className={`mb-3 text-ink-soft ${compact ? 'text-[11px]' : 'text-xs'}`}>
          <span className="font-medium text-ink-soft">Market definition: </span>
          {table?.market_definition || syndicated.market_definition}
          {syndicated?.year ? ` (${syndicated.year})` : ''}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-3 w-8">#</th>
              <th className="px-3 py-3">Vendor</th>
              <th className="px-3 py-3 text-right">Published</th>
              <th className="px-3 py-3 text-right">Estimated</th>
              <th className="px-3 py-3 text-right">Δ</th>
              <th className="px-3 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {displayRows.slice(0, compact ? 6 : 12).map((row) => (
              <tr key={`${row.rank}-${row.name}`}>
                <td className="px-3 py-2.5 tabular-nums text-ink-faint">{row.rank}</td>
                <td className="px-3 py-2.5 font-medium text-ink">{row.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-accent">
                  {row.published_share_pct != null ? `${row.published_share_pct}%` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                  {row.estimated_presence_pct != null ? `${row.estimated_presence_pct}%` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.delta_pp != null ? (
                    <span className={row.delta_pp > 0 ? 'text-amber-700' : row.delta_pp < 0 ? 'text-emerald-700' : 'text-ink-soft'}>
                      {row.delta_pp > 0 ? '+' : ''}{row.delta_pp}pp
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-soft">
                  {row.source_url ? (
                    <a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                      {row.publisher || 'Source'}
                      <Icon name="external" className="h-3 w-3" />
                    </a>
                  ) : (
                    row.publisher || '—'
                  )}
                  {row.confidence && (
                    <span className={`chip ml-1 text-[10px] ${CONF_BADGE[row.confidence] || CONF_BADGE.medium}`}>
                      {row.confidence}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-soft">
        {table?.cr4_published_pct != null && table.matched_count >= 2 && (
          <span className="chip border-ink-700 bg-ink-850">Published CR4 ≈ {table.cr4_published_pct}%</span>
        )}
        {table?.matched_count != null && (
          <span className="chip border-ink-700 bg-ink-850">{table.matched_count} matched to your competitors</span>
        )}
      </div>
      {(syndicated?.disclaimer || table?.disclaimer) && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{syndicated?.disclaimer || table?.disclaimer}</p>
      )}
    </div>
  );
}

export function PricingChangesCard({ recentChanges, count, compact }) {
  if (!recentChanges?.length) return null;
  return (
    <div className={compact ? '' : 'card p-5'}>
      <h2 className={`font-semibold text-ink ${compact ? 'text-xs' : 'text-sm'}`}>Pricing changes (7 days)</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        {count} change{count !== 1 ? 's' : ''} among monitored competitors
      </p>
      <ul className="mt-3 space-y-2">
        {recentChanges.map((c, i) => (
          <li key={i} className="flex gap-3 text-xs">
            <span className="shrink-0 text-ink-faint">{timeAgo(c.detected_at)}</span>
            <span className="font-medium text-ink-soft">{c.competitor_name}</span>
            <span className="text-ink-soft truncate">{c.summary || 'Pricing updated'}</span>
          </li>
        ))}
      </ul>
      <Link href="/changes" className="mt-3 inline-block text-xs text-accent hover:underline">
        View all changes
      </Link>
    </div>
  );
}

export function DistributionEmptyState({ competitorCount, onRunResearch, researching }) {
  if (competitorCount === 0) {
    return (
      <div className="card p-5 text-sm text-ink-soft">
        Add approved competitors on the{' '}
        <Link href="/app" className="text-accent hover:underline">Analysis</Link> page first.
      </div>
    );
  }
  return (
    <div className="card space-y-4 p-6 text-center">
      <Icon name="bar" className="mx-auto h-10 w-10 text-ink-faint" />
      <div>
        <p className="font-medium text-ink">No distribution snapshot yet</p>
        <p className="mt-1 text-sm text-ink-soft">
          Run market intelligence to estimate how presence splits across {competitorCount} tracked competitor
          {competitorCount !== 1 ? 's' : ''}.
        </p>
      </div>
      <button type="button" onClick={onRunResearch} disabled={researching} className="btn-primary mx-auto">
        Run market research
      </button>
      <p className="text-xs text-ink-faint">
        Tip: build your <Link href="/market" className="text-ink-soft underline">market model</Link> first for TAM-based share estimates.
      </p>
    </div>
  );
}

export function exportDistributionPdf({ pulseData, title = 'Market distribution brief' }) {
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const dist = pulseData?.distribution;
  const syndicated = pulseData?.syndicated;
  const items = (dist?.items || []).slice(0, 10);
  const maxP = Math.max(1, ...items.map((i) => i.presence_pct ?? i.share_pct ?? 0));
  const presenceRows = items
    .map((item, i) => {
      const pct = item.presence_pct ?? item.share_pct ?? 0;
      return `<tr><td>${esc(item.name)}</td><td style="text-align:right;font-weight:700">${pct}%</td><td style="text-align:right">${item.share_pct_tam != null ? item.share_pct_tam + '%' : '—'}</td></tr>`;
    })
    .join('');
  const synRows = (syndicated?.table?.rows || [])
    .slice(0, 8)
    .map(
      (r) =>
        `<tr><td>${esc(r.name)}</td><td style="text-align:right">${r.published_share_pct != null ? r.published_share_pct + '%' : '—'}</td><td style="text-align:right">${r.estimated_presence_pct != null ? r.estimated_presence_pct + '%' : '—'}</td><td>${esc(r.publisher || '')}</td></tr>`
    )
    .join('');
  const insights = (pulseData?.insights || [])
    .filter((x) => x.type !== 'missing')
    .map((ins) => `<li><b>${esc(ins.title)}</b> — ${esc(ins.body)}</li>`)
    .join('');

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: -apple-system, sans-serif; color:#0f172a; max-width:720px; margin:40px auto; padding:0 28px; line-height:1.5; }
  h1 { font-size:24px; } h2 { font-size:13px; text-transform:uppercase; color:#475569; margin-top:24px; }
  table { width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; }
  td, th { padding:8px; border-bottom:1px solid #e2e8f0; text-align:left; }
  .muted { color:#64748b; font-size:12px; }
  ul { font-size:13px; }
</style></head><body>
  <h1>${esc(title)}</h1>
  <p class="muted">Generated ${new Date().toLocaleDateString()} — directional estimates, not licensed syndicated data.</p>
  ${syndicated?.table?.rows?.length ? `<h2>Published market share</h2><table><thead><tr><th>Vendor</th><th>Published</th><th>Estimated</th><th>Source</th></tr></thead><tbody>${synRows}</tbody></table>` : ''}
  <h2>Estimated presence</h2>
  <table><thead><tr><th>Company</th><th>Presence</th><th>TAM share</th></tr></thead><tbody>${presenceRows}</tbody></table>
  ${dist?.cr4_pct != null ? `<p class="muted">CR4 ≈ ${dist.cr4_pct}%</p>` : ''}
  ${insights ? `<h2>Insights</h2><ul>${insights}</ul>` : ''}
  <p class="muted">${esc(dist?.disclaimer || '')}</p>
  <script>window.print()</script>
</body></html>`);
  w.document.close();
}

/** Unified distribution panel for /market, /distribution, and reports. */
export function DistributionPanel({
  pulseData,
  tamContext,
  compact = false,
  showRefresh = false,
  onRefresh,
  researching = false,
  showPricingChanges = true,
  showSyndicated = true,
  showExport = false,
  showFullLink = false,
  className = '',
}) {
  const distribution = pulseData?.distribution;
  const syndicated = pulseData?.syndicated;
  const hasData = distribution?.items?.length > 0;

  if (!hasData) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {tamContext && (
        <p className="text-xs text-ink-soft">
          TAM {fmtUsd(tamContext.tamValue)} → your SOM {fmtUsd(tamContext.somValue)}
          {tamContext.targetSharePct != null ? ` (${tamContext.targetSharePct} obtainable)` : ''}
        </p>
      )}

      <DistributionMetaChips distribution={distribution} compact={compact} />

      {pulseData?.pulse?.significant?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-500/5 p-3 text-xs text-amber-200">
          <span className="font-semibold">Notable shift: </span>
          {pulseData.pulse.significant
            .slice(0, 3)
            .map((s) => `${s.name} ${s.delta_pct > 0 ? '+' : ''}${s.delta_pct}pp`)
            .join(' · ')}
        </div>
      )}

      <InsightGrid insights={pulseData?.insights} limit={compact ? 2 : 4} compact={compact} />
      <PulseBanner pulse={pulseData?.pulse} limit={compact ? 4 : 6} compact={compact} />

      {showSyndicated && (
        <div className={`rounded-2xl border border-ink-700 bg-ink-900 ${compact ? 'p-4' : 'p-5'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className={`font-semibold text-ink ${compact ? 'text-xs' : 'text-sm'}`}>Published market share</h3>
              <p className="mt-0.5 text-[11px] text-ink-soft">Analyst figures from public sources — separate from estimates</p>
            </div>
            <Link href="/methodology" className="chip border-ink-600 bg-ink-850 text-ink-soft hover:text-ink">
              <Icon name="shield" className="h-3 w-3" /> Methodology
            </Link>
          </div>
          <div className="mt-4">
            <SyndicatedShareTable syndicated={syndicated} compact={compact} />
          </div>
        </div>
      )}

      <div className={`rounded-2xl border border-ink-700 bg-ink-900 ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className={`font-semibold text-ink ${compact ? 'text-xs' : 'text-sm'}`}>
              {distribution.method === 'triangulated' ? 'Triangulated presence' : 'Estimated presence'}
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              {METHOD_HINT[distribution.method] || distribution.disclaimer}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showExport && (
              <button
                type="button"
                onClick={() => exportDistributionPdf({ pulseData })}
                className="chip border-ink-600 bg-ink-850 text-ink-soft hover:text-ink"
              >
                <Icon name="download" className="h-3 w-3" /> Export PDF
              </button>
            )}
            {showFullLink && (
              <Link href="/distribution" className="chip border-accent/30 bg-accent/10 text-accent hover:text-ink">
                Full distribution →
              </Link>
            )}
            {showRefresh && onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={researching}
                className="chip border-ink-600 bg-ink-850 text-ink-soft hover:text-ink disabled:opacity-50"
              >
                <Icon name={researching ? 'refresh' : 'trending'} className={`h-3 w-3 ${researching ? 'animate-spin' : ''}`} />
                {researching ? 'Updating…' : 'Refresh'}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <PresenceChart distribution={distribution} limit={compact ? 6 : 10} barHeight={compact ? 'h-2' : 'h-3'} />
        </div>
      </div>

      {!compact && (
        <div className="card overflow-hidden p-0">
          <EstimatedShareTable distribution={distribution} />
        </div>
      )}

      {showPricingChanges && !compact && (
        <PricingChangesCard recentChanges={pulseData?.recent_changes} count={pulseData?.pricing_changes_7d} />
      )}
    </div>
  );
}
