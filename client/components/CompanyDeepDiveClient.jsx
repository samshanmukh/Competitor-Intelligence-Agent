'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { getWorkspace } from '../lib/auth';
import { Icon, Skeleton, useToast } from './ui';

const TIP = { background: '#0e1014', border: '1px solid #181c24', borderRadius: 8, fontSize: 12 };
const AXIS = { fill: '#64748b', fontSize: 11 };
const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee'];

function fmtVisits(n) {
  if (n == null) return '—';
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
  const toast = useToast();

  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const jobKey = () => `cia_deepdive_job_${getWorkspace()?.id || 'x'}`;

  const stop = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = tickRef.current = null;
    setRunning(false);
    try { localStorage.removeItem(jobKey()); } catch {}
  };

  const beginPolling = (jobId, startedAt, label) => {
    try { localStorage.setItem(jobKey(), JSON.stringify({ jobId, startedAt, label })); } catch {}
    setRunning(true);
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const check = async () => {
      try {
        const { status, result, error } = await api.deepDiveStatus(jobId);
        if (status === 'done') {
          stop();
          if (result?.dossier) { setDossier(result.dossier); toast({ type: 'success', title: 'Deep dive ready' }); }
          else toast({ type: 'info', title: 'No data found' });
        } else if (status === 'error') {
          stop();
          toast({ type: 'error', title: 'Deep dive failed', message: error });
        }
      } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') { stop(); toast({ type: 'error', title: 'Job expired', message: 'Please run it again.' }); }
      }
    };
    pollRef.current = setInterval(check, 5000);
    check();
  };

  const run = async () => {
    if (!form.company.trim()) { toast({ type: 'error', title: 'Enter a company name' }); return; }
    setDossier(null);
    try {
      const { jobId } = await api.deepDiveStart(form.company.trim(), form.url.trim());
      beginPolling(jobId, Date.now(), form.company.trim());
    } catch (err) {
      toast({ type: 'error', title: 'Could not start', message: err.message });
    }
  };

  // Resume an in-flight deep dive after a refresh / navigation.
  useEffect(() => {
    let raw; try { raw = localStorage.getItem(jobKey()); } catch {}
    if (raw) {
      try { const { jobId, startedAt, label } = JSON.parse(raw); if (jobId) { setForm((f) => ({ ...f, company: label || f.company })); beginPolling(jobId, startedAt || Date.now(), label); } } catch {}
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Company Deep Dive</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter any company — get a full dossier: overview, financials, market value, web traffic, and review analysis.
        </p>
      </div>

      {/* Input */}
      <div className="card p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="label">Company name</label>
            <input className="input" placeholder="Notion" value={form.company} disabled={running}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') run(); }} autoFocus />
          </div>
          <div>
            <label className="label">Website / domain (optional)</label>
            <input className="input" placeholder="notion.so" value={form.url} disabled={running}
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
          Runs in the background (~2–5 min) — you can navigate away and we'll notify you when the dossier is ready.
        </p>
      </div>

      {/* In-progress */}
      {running && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-accent-soft">
            <Icon name="refresh" className="h-4 w-4 animate-spin" />
            Building dossier for <strong className="text-white">{form.company}</strong>…
            <span className="tabular-nums text-slate-400">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Overview, financials, market value, web traffic &amp; reviews. Deep research + traffic scraping take a few
            minutes — you can leave this page; we'll send a notification when it's done.
          </p>
        </div>
      )}

      {/* Result */}
      {dossier && (
        <div className="space-y-5">
          <OverviewSection state={{ loading: false, data: dossier.overview }} />
          <FinancialsSection state={{ loading: false, data: dossier.financials }} />
          <MarketSection market={dossier.market} loading={false} />
          <TrafficSection state={{ loading: false, data: dossier.traffic, configured: dossier.trafficConfigured !== false, blocked: dossier.trafficBlocked, error: dossier.trafficError }} />
          <ReviewsSection state={{ loading: false, data: dossier.reviews }} />
        </div>
      )}
    </div>
  );
}

function SectionCard({ icon, title, loading, empty, children, hint }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name={icon} className="h-4 w-4 text-accent-soft" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {loading && <Icon name="refresh" className="h-3.5 w-3.5 animate-spin text-slate-500 ml-1" />}
        {hint && <span className="ml-auto text-xs text-slate-600">{hint}</span>}
      </div>
      {loading ? <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
        : empty ? <p className="text-sm text-slate-500">{empty}</p>
        : children}
    </section>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent || 'text-white'}`}>{value ?? '—'}</p>
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
    <SectionCard icon="radar" title="Company overview" loading={state.loading} empty={!o ? 'No overview found.' : null}>
      {o && (
        <div className="space-y-3">
          {o.summary && <p className="text-sm text-slate-300 leading-relaxed">{o.summary}</p>}
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Founded" value={o.founded} />
            <Stat label="HQ" value={o.headquarters} />
            <Stat label="Employees" value={o.employees} />
            <Stat label="Model" value={o.business_model} />
          </div>
          {o.products?.length > 0 && (
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Products</p><Chips items={o.products} /></div>
          )}
          {o.recent_news?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent news</p>
              <ul className="space-y-1">{o.recent_news.map((n, i) => <li key={i} className="text-xs text-slate-400">• {n}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function FinancialsSection({ state }) {
  const f = state.data;
  return (
    <SectionCard icon="trending" title="Financials & valuation" loading={state.loading}
      hint={state.loading ? 'deep research…' : undefined} empty={!f ? 'No financial data found.' : null}>
      {f && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Total funding" value={f.total_funding} accent="text-emerald-400" />
            <Stat label="Valuation" value={f.valuation} accent="text-accent-soft" />
            <Stat label="Revenue (est.)" value={f.revenue} />
            <Stat label="Employees" value={f.employees} />
          </div>
          {f.investors?.length > 0 && (
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Key investors</p><Chips items={f.investors} color="accent" /></div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function MarketSection({ market, loading }) {
  const history = (market?.history || []).filter((h) => h.year && typeof h.size_usd_millions === 'number');
  return (
    <SectionCard icon="bar" title="Market size & growth" loading={loading}
      hint={loading ? 'deep research…' : undefined} empty={!loading && !market ? 'No market data found.' : null}>
      {market && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Market size" value={market.size_current} />
            <Stat label="Growth" value={market.cagr} accent="text-emerald-400" />
          </div>
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
        </div>
      )}
    </SectionCard>
  );
}

function TrafficSection({ state }) {
  const t = state.data;
  if (!state.loading && state.configured === false) {
    return (
      <SectionCard icon="activity" title="Web traffic"
        empty="Apify not configured — set APIFY_TOKEN on the server to enable traffic data." />
    );
  }
  if (!state.loading && !t && (state.error || state.blocked)) {
    const needsApproval = /not-approved|permission/i.test(state.error || '');
    return (
      <SectionCard icon="activity" title="Web traffic">
        {needsApproval ? (
          <>
            <p className="text-sm text-amber-300">The SimilarWeb Actor needs a one-time permission approval in Apify.</p>
            <p className="mt-1 text-xs text-slate-500">Open it in <a href="https://console.apify.com/actors" target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">Apify Console</a>, run once / approve, then retry.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-amber-300">Traffic data unavailable — SimilarWeb blocks non-residential IPs.</p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Traffic routes through Apify <strong>residential proxies</strong>, which are only available on a{' '}
              <strong>paid Apify plan</strong> (the free tier returns 403). Upgrade at{' '}
              <a href="https://console.apify.com/billing" target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">Apify Billing</a>{' '}
              to enable them — once active, traffic loads automatically (no code change). The rest of the dossier is
              unaffected.
            </p>
          </>
        )}
      </SectionCard>
    );
  }
  const history = (t?.history || []).filter((h) => h.date && typeof h.visits === 'number').slice(-12);
  const sources = (t?.sources || []).map((s, i) => ({ ...s, pct: Math.round((s.share || 0) * 100), color: COLORS[i % COLORS.length] }));
  return (
    <SectionCard icon="activity" title="Web traffic" loading={state.loading}
      hint={t?.global_rank ? `global rank #${t.global_rank.toLocaleString()}` : undefined}
      empty={!state.loading && !t ? 'No traffic data found for this domain.' : null}>
      {t && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Monthly visits" value={fmtVisits(t.total_visits)} accent="text-accent-soft" />
            <Stat label="Bounce rate" value={t.bounce_rate != null ? `${Math.round(t.bounce_rate * 100)}%` : null} />
            <Stat label="Pages / visit" value={t.pages_per_visit != null ? t.pages_per_visit.toFixed(1) : null} />
            <Stat label="Avg. visit" value={t.avg_visit_duration} />
          </div>

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
            {sources.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Traffic sources</p>
                <div className="space-y-1.5">
                  {sources.map((s) => (
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
    <SectionCard icon="users" title="User reviews & AI analysis" loading={state.loading}
      empty={!r || !r.sentiment ? 'No public review data found.' : null}>
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
        </div>
      )}
    </SectionCard>
  );
}
