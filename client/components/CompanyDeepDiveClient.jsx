'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { ensureHttps } from '../lib/normalizeUrl';
import { Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';
import { SkillChipRow, SourceAttribution } from './SourceAttribution';

const TIP = { background: '#0e1014', border: '1px solid #181c24', borderRadius: 8, fontSize: 12 };
const AXIS = { fill: '#64748b', fontSize: 11 };
const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee'];

function fmtVisits(n) {
  if (n == null) return '-';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export default function CompanyDeepDiveClient() {
  const [form, setForm] = useState({ company: '', url: '' });
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dossier, setDossier] = useState(null);
  const [implications, setImplications] = useState(null);
  const [implLoading, setImplLoading] = useState(false);
  const [compareInput, setCompareInput] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [savingDossier, setSavingDossier] = useState(false);
  const [finRefreshing, setFinRefreshing] = useState(false);
  const toast = useToast();

  const run = async () => {
    if (!form.company.trim()) { toast({ type: 'error', title: 'Enter a company name' }); return; }
    const siteUrl = ensureHttps(form.url);
    if (siteUrl && siteUrl !== form.url.trim()) setForm((f) => ({ ...f, url: siteUrl }));
    const startedAt = Date.now();
    setDossier(null);
    setImplications(null);
    setRunning(true);
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    try {
      const { dossier: result } = await api.deepDive(form.company.trim(), siteUrl);
      if (!result) throw new Error('You.com did not return a dossier.');
      setDossier(result);
      toast({ type: 'success', title: 'Deep market search ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Research failed', message: err.message });
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  };

  const refreshFinancials = async () => {
    const company = form.company.trim() || dossier?.company || dossier?.overview?.name;
    if (!company) return;
    setFinRefreshing(true);
    try {
      const res = await api.companyFinancials(company, dossier?.url || ensureHttps(form.url));
      setDossier((d) => d ? { ...d, financials: res.financials || null, market: res.market ?? d.market } : d);
      toast({ type: 'success', title: 'Financials refreshed' });
    } catch (err) {
      toast({ type: 'error', title: 'Finance refresh failed', message: err.message });
    } finally {
      setFinRefreshing(false);
    }
  };

  return (
    <LabShell
      title="Deep market search"
      subtitle="You.com-powered company research with financials, a market model, traffic, reviews, and cited sources."
      skills={[{ skill: 'you-research' }]}
    >
      <LabPanel title="Company">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="deep-dive-company" className="label">Company name</label>
            <input id="deep-dive-company" className="input" placeholder="Notion" value={form.company} disabled={running}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') run(); }} autoFocus />
          </div>
          <div>
            <label htmlFor="deep-dive-url" className="label">Website / domain (optional)</label>
            <input id="deep-dive-url" className="input" placeholder="notion.so" value={form.url} disabled={running}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={running} className="btn-primary w-full sm:w-auto">
              <Icon name={running ? 'refresh' : 'search'} className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Researching…' : 'Analyze'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          You.com Research usually returns in under a minute. Keep this page open while it runs.
        </p>
      </LabPanel>

      {running && (
        <LabPanel title={`Building dossier · ${form.company}`}>
          <p className="mb-4 text-xs text-slate-500">
            You.com is researching the company, financials, market model, traffic, and reviews.
            <span className="ml-2 tabular-nums text-slate-400">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Overview', 'Financials', 'Traffic', 'Reviews'].map((label) => (
              <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="mb-2 text-xs font-semibold text-slate-400">{label}</p>
                <LabShimmerBlock rows={2} />
              </div>
            ))}
          </div>
        </LabPanel>
      )}

      {dossier && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              className="btn-ghost text-sm"
              disabled={finRefreshing}
              onClick={refreshFinancials}
            >
              <Icon name={finRefreshing ? 'refresh' : 'trending'} className={`h-4 w-4 ${finRefreshing ? 'animate-spin' : ''}`} />
              {finRefreshing ? 'Refreshing finance…' : 'Refresh financials'}
            </button>
            <button
              className="btn-ghost text-sm"
              disabled={implLoading}
              onClick={async () => {
                setImplLoading(true);
                try {
                  const { result } = await api.getImplications(dossier);
                  setImplications(result);
                } catch (err) {
                  toast({ type: 'error', title: 'Implications failed', message: err.message });
                } finally {
                  setImplLoading(false);
                }
              }}
            >
              {implLoading ? 'Thinking…' : 'What this means for us'}
            </button>
            <button
              className="btn-ghost text-sm"
              disabled={savingDossier}
              onClick={async () => {
                setSavingDossier(true);
                try {
                  await api.saveReport(
                    `Deep market search · ${form.company || dossier?.overview?.name || 'Company'} · ${new Date().toLocaleDateString()}`,
                    { type: 'deep-dive', dossier, implications, generatedAt: new Date().toISOString() }
                  );
                  toast({ type: 'success', title: 'Saved to history' });
                } catch (err) {
                  toast({ type: 'error', title: 'Could not save', message: err.message });
                } finally {
                  setSavingDossier(false);
                }
              }}
            >
              {savingDossier ? 'Saving…' : 'Save dossier'}
            </button>
          </div>

          {finRefreshing && (
            <LabPanel title="Financials">
              <LabShimmerBlock rows={2} />
            </LabPanel>
          )}

          {implications && (
            <LabPanel title="Implications for us" ready>
              <p className="text-sm text-slate-300">{implications.summary}</p>
              {implications.threats?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-rose-300">Threats</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-400 list-disc pl-4">
                    {implications.threats.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {implications.opportunities?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-300">Opportunities</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-400 list-disc pl-4">
                    {implications.opportunities.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {implications.actions?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-accent-soft">Actions</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-400 list-disc pl-4">
                    {implications.actions.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
            </LabPanel>
          )}

          <OverviewSection state={{ loading: false, data: dossier.overview }} />
          {!finRefreshing && <FinancialsSection state={{ loading: false, data: dossier.financials }} />}
          <MarketSection market={dossier.market} loading={false} />
          <TrafficSection state={{ loading: false, data: dossier.traffic, configured: dossier.trafficConfigured !== false, blocked: dossier.trafficBlocked, error: dossier.trafficError }} />
          <ReviewsSection state={{ loading: false, data: dossier.reviews }} />
        </div>
      )}

      <LabPanel title="Compare companies">
        <p className="mb-3 text-xs text-slate-500">Enter 2–4 names separated by commas.</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Notion, Coda, Airtable"
            value={compareInput}
            onChange={(e) => setCompareInput(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={compareLoading}
            onClick={async () => {
              const companies = compareInput.split(',').map((s) => s.trim()).filter(Boolean);
              if (companies.length < 2) {
                toast({ type: 'error', title: 'Need at least 2 companies' });
                return;
              }
              setCompareLoading(true);
              try {
                const { result } = await api.compareCompanies(companies);
                setCompareResult(result);
              } catch (err) {
                toast({ type: 'error', title: 'Compare failed', message: err.message });
              } finally {
                setCompareLoading(false);
              }
            }}
          >
            {compareLoading ? 'Comparing…' : 'Compare'}
          </button>
        </div>
        {compareLoading && <div className="mt-4"><LabShimmerBlock rows={2} /></div>}
        {compareResult && !compareLoading && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-300">{compareResult.summary}</p>
            <p className="text-sm text-accent-soft">{compareResult.recommendation}</p>
            {compareResult.implicationsForUs?.length > 0 && (
              <ul className="list-disc pl-4 text-sm text-slate-400 space-y-1">
                {compareResult.implicationsForUs.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            )}
          </div>
        )}
      </LabPanel>
    </LabShell>
  );
}

function SectionCard({ icon, title, loading, empty, children, hint, skills, skill }) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Icon name={icon} className="h-4 w-4 text-accent-soft" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {!loading && children && !empty && (
            <span className="tab-ready rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-soft">Ready</span>
          )}
          {hint && <span className="text-xs text-slate-600">{hint}</span>}
        </div>
        {(skills?.length || skill) && !loading && (
          <SkillChipRow skills={skills} skill={skill} size="sm" />
        )}
      </div>
      {loading ? <LabShimmerBlock rows={2} />
        : empty ? <p className="text-sm text-slate-500">{empty}</p>
        : children}
    </section>
  );
}

function Stat({ label, value, accent }) {
  if (value == null || value === '' || value === '-') return null;
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${accent || 'text-white'}`}>{value}</p>
    </div>
  );
}

function StatGrid({ children, className = '' }) {
  return (
    <div className={`grid max-w-3xl grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 ${className}`}>
      {children}
    </div>
  );
}

function Chips({ items, color = 'slate' }) {
  const tones = {
    slate: 'border-ink-700 bg-ink-850 text-slate-300',
    accent: 'border-accent/30 bg-accent/10 text-accent-soft',
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {(items || []).map((it, i) => (
        <span key={i} className={`chip text-[11px] ${tones[color]}`}>{it}</span>
      ))}
    </div>
  );
}

function OverviewSection({ state, company }) {
  const o = state.data;
  return (
    <SectionCard icon="radar" title="Company overview" loading={state.loading} empty={!o ? 'No overview found.' : null} skill="you-research">
      {o && (
        <div className="space-y-3">
          {o.summary && <p className="text-sm text-slate-300 leading-relaxed">{o.summary}</p>}
          <StatGrid>
            <Stat label="Founded" value={o.founded} />
            <Stat label="HQ" value={o.headquarters} />
            <Stat label="Employees" value={o.employees} />
            <Stat label="Model" value={o.business_model} />
          </StatGrid>
          {o.products?.length > 0 && (
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Products</p><Chips items={o.products} /></div>
          )}
          {o.recent_news?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent news</p>
              <ul className="space-y-1">{o.recent_news.map((n, i) => <li key={i} className="text-xs text-slate-400">• {n}</li>)}</ul>
            </div>
          )}
          <SourceAttribution attribution={o.attribution} sources={o.sources} skill={o.skill} skillLabel={o.skillLabel} compact />
        </div>
      )}
    </SectionCard>
  );
}

function FinancialsSection({ state }) {
  const f = state.data;
  return (
    <SectionCard icon="trending" title="Financials & valuation" loading={state.loading}
      hint={state.loading ? 'You.com research…' : undefined} empty={!f ? 'No financial data found.' : null}
      skill="you-research">
      {f && (
        <div className="space-y-3">
          <StatGrid>
            <Stat label="Total funding" value={f.total_funding} accent="text-emerald-400" />
            <Stat label="Valuation" value={f.valuation} accent="text-accent-soft" />
            <Stat label="Revenue (est.)" value={f.revenue} />
            <Stat label="Employees" value={f.employees} />
          </StatGrid>
          {f.investors?.length > 0 && (
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Key investors</p><Chips items={f.investors} color="accent" /></div>
          )}
          <SourceAttribution attribution={f.attribution} sources={f.sources} skill={f.skill} skillLabel={f.skillLabel} compact />
        </div>
      )}
    </SectionCard>
  );
}

function MarketSection({ market, loading }) {
  const history = (market?.history || []).filter((h) => h.year && typeof h.size_usd_millions === 'number');
  return (
    <SectionCard icon="bar" title="Market model · size & growth" loading={loading}
      hint={loading ? 'You.com research…' : undefined} empty={!loading && !market ? 'No market data found.' : null}
      skill="you-research">
      {market && (
        <div className="space-y-3">
          {market.category && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{market.category}</p>}
          <StatGrid>
            <Stat label="TAM" value={market.tam || market.size_current} />
            <Stat label="SAM" value={market.sam} />
            <Stat label="SOM" value={market.som} />
            <Stat label="Growth" value={market.cagr} accent="text-emerald-400" />
          </StatGrid>
          {history.length >= 2 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history} margin={{ left: 4, right: 16, top: 8 }}>
                <CartesianGrid stroke="#181c24" />
                <XAxis dataKey="year" tick={AXIS} />
                <YAxis tick={AXIS} tickFormatter={(v) => `$${v}M`} />
                <Tooltip contentStyle={TIP} formatter={(v) => [`$${v}M`, 'Market size']} />
                <Line type="monotone" dataKey="size_usd_millions" stroke="#818cf8" strokeWidth={2} dot={{ r: 3, fill: '#818cf8' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {market.summary && <p className="text-sm text-slate-400 leading-relaxed">{market.summary}</p>}
          {market.methodology && (
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Model methodology</p>
              <p className="text-xs leading-relaxed text-slate-400">{market.methodology}</p>
            </div>
          )}
          {market.assumptions?.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assumptions</p>
              <ul className="space-y-1 pl-4 text-xs text-slate-400 list-disc">
                {market.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}
              </ul>
            </div>
          )}
          <SourceAttribution attribution={market.attribution} sources={market.sources} skill={market.skill} skillLabel={market.skillLabel} compact />
        </div>
      )}
    </SectionCard>
  );
}

function TrafficSection({ state }) {
  const t = state.data;
  if (!state.loading && !t && state.error) {
    return (
      <SectionCard icon="activity" title="Web traffic">
        <p className="text-sm text-amber-300">Traffic research unavailable.</p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{state.error}</p>
      </SectionCard>
    );
  }
  const history = (t?.history || []).filter((h) => h.date && typeof h.visits === 'number').slice(-12);
  const channels = (t?.trafficChannels || (Array.isArray(t?.sources) && t.sources[0]?.channel ? t.sources : []) || [])
    .map((s, i) => ({ ...s, pct: Math.round((s.share || 0) * 100), color: COLORS[i % COLORS.length] }));
  return (
    <SectionCard icon="activity" title="Web traffic" loading={state.loading}
      hint={t?.global_rank ? `global rank #${t.global_rank.toLocaleString()}` : undefined}
      empty={!state.loading && !t ? 'No traffic estimates found in research.' : null}
      skill="you-research">
      {t && (
        <div className="space-y-4">
          <StatGrid>
            <Stat label="Monthly visits" value={fmtVisits(t.total_visits)} accent="text-accent-soft" />
            <Stat label="Bounce rate" value={t.bounce_rate != null ? `${Math.round(t.bounce_rate * 100)}%` : null} />
            <Stat label="Pages / visit" value={t.pages_per_visit != null ? t.pages_per_visit.toFixed(1) : null} />
            <Stat label="Avg. visit" value={t.avg_visit_duration} />
          </StatGrid>

          {history.length >= 2 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly visits trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history} margin={{ left: 4, right: 16, top: 8 }}>
                  <CartesianGrid stroke="#181c24" />
                  <XAxis dataKey="date" tick={AXIS} />
                  <YAxis tick={AXIS} tickFormatter={fmtVisits} />
                  <Tooltip contentStyle={TIP} formatter={(v) => [fmtVisits(v), 'Visits']} />
                  <Line type="monotone" dataKey="visits" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {channels.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Traffic mix</p>
                <div className="space-y-1.5">
                  {channels.map((s) => (
                    <div key={s.channel} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 capitalize text-slate-400">{s.channel}</span>
                      <div className="h-2 flex-1 rounded-full bg-ink-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                      </div>
                      <span className="w-9 text-right tabular-nums text-slate-400">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {t.topCountries?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Top countries</p>
                <div className="space-y-1.5">
                  {t.topCountries.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 truncate text-slate-400">{c.country}</span>
                      <div className="h-2 flex-1 rounded-full bg-ink-800 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((c.share || 0) * 100)}%` }} />
                      </div>
                      <span className="w-9 text-right tabular-nums text-slate-400">{Math.round((c.share || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <SourceAttribution attribution={t.attribution} sources={t.attribution?.sources || (t.sources?.[0]?.url ? t.sources : [])} skill={t.skill} skillLabel={t.skillLabel} compact />
        </div>
      )}
    </SectionCard>
  );
}

function ReviewsSection({ state }) {
  const r = state.data;
  const tone = {
    positive: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-400',
    mixed: 'border-amber-800/50 bg-amber-950/30 text-amber-400',
    negative: 'border-rose-800/50 bg-rose-950/30 text-rose-400',
  };
  return (
    <SectionCard icon="users" title="User reviews & analysis" loading={state.loading}
      empty={!r || !r.sentiment ? 'No public review data found.' : null}
      skill="you-research">
      {r && r.sentiment && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {r.rating != null && (
              <span className="inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < Math.round(r.rating) ? 'text-amber-400' : 'text-ink-600'}>★</span>
                ))}
                <span className="ml-1 text-sm text-slate-400">{r.rating}/5</span>
              </span>
            )}
            <span className={`chip text-[10px] ${tone[r.sentiment] || tone.mixed}`}>{r.sentiment}</span>
          </div>
          {r.summary && <p className="text-sm text-slate-300">“{r.summary}”</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {r.pros?.length > 0 && (
              <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Loved</p>
                <ul className="space-y-1">{r.pros.map((p, i) => <li key={i} className="text-xs text-slate-300">+ {p}</li>)}</ul>
              </div>
            )}
            {r.cons?.length > 0 && (
              <div className="rounded-lg border border-rose-900/30 bg-rose-950/10 p-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-500">Complaints</p>
                <ul className="space-y-1">{r.cons.map((c, i) => <li key={i} className="text-xs text-slate-300">− {c}</li>)}</ul>
              </div>
            )}
          </div>
          {r.ai_analysis && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent-soft">AI analysis</p>
              <p className="text-sm text-slate-300">{r.ai_analysis}</p>
            </div>
          )}
          <SourceAttribution attribution={r.attribution} sources={r.sources} skill={r.skill} skillLabel={r.skillLabel} compact />
        </div>
      )}
    </SectionCard>
  );
}
