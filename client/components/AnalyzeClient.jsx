'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace } from '../lib/auth';
import { Icon, Skeleton, useToast } from './ui';
import ReportView from './ReportView';

export default function AnalyzeClient() {
  const [product, setProduct] = useState(undefined); // undefined = loading, null = none
  const [competitors, setCompetitors] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const [{ product }, { competitors }] = await Promise.all([
        api.getProduct().catch(() => ({ product: null })),
        api.listCompetitors('approved').catch(() => ({ competitors: [] })),
      ]);
      setProduct(product);
      setCompetitors(competitors || []);
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load', message: err.message });
      setProduct(null);
      setCompetitors([]);
    }
  };

  useEffect(() => { load(); api.recordVisit().catch(() => {}); }, []);

  if (product === undefined || competitors === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">Competitive Analysis</h1>
        <p className="text-sm text-slate-500">
          Define your product, find its closest competitors, and get a full value + pricing + reviews breakdown.
        </p>
      </header>

      <ProductStage product={product} onSaved={(p) => setProduct(p)} />

      {product && (
        <CompetitorStage
          product={product}
          competitors={competitors}
          onChange={(list) => setCompetitors(list)}
        />
      )}

      {product && competitors.length > 0 && (
        <ReportStage competitors={competitors} onScored={load} />
      )}
    </div>
  );
}

/* ─────────────────────────── Stage 1: Product ─────────────────────────── */
function ProductStage({ product, onSaved }) {
  const [editing, setEditing] = useState(!product);
  const [form, setForm] = useState({
    name: product?.name || '',
    pricing_url: product?.pricing_url || '',
    description: product?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const toast = useToast();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const autofill = async () => {
    if (!form.pricing_url) return;
    setInferring(true);
    try {
      const { description } = await api.inferProduct(form.pricing_url);
      if (description) setForm((f) => ({ ...f, description }));
      toast({ type: 'success', title: 'Read your site' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not read URL', message: err.message });
    } finally {
      setInferring(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ type: 'error', title: 'Add a company / product name' }); return; }
    setSaving(true);
    try {
      const { product: saved } = await api.saveProduct(form);
      onSaved(saved);
      setEditing(false);
      toast({ type: 'success', title: 'Product saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (product && !editing) {
    return (
      <StageCard step={1} title="Your product" done>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-soft text-lg font-bold">
              {product.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white">{product.name}</h3>
              {product.pricing_url && (
                <a href={product.pricing_url} target="_blank" rel="noreferrer"
                  className="text-xs text-accent-soft hover:underline inline-flex items-center gap-1">
                  {product.pricing_url} <Icon name="external" className="h-3 w-3" />
                </a>
              )}
              {product.description && (
                <>
                  <p className={`mt-1.5 text-sm text-slate-400 whitespace-pre-line ${expanded ? '' : 'line-clamp-2'}`}>
                    {product.description}
                  </p>
                  {product.description.length > 140 && (
                    <button
                      onClick={() => setExpanded((e) => !e)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-accent-soft hover:text-white transition"
                    >
                      {expanded ? 'Show less' : 'Show more'}
                      <Icon name={expanded ? 'chevronUp' : 'chevronDown'} className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="btn-ghost shrink-0 py-1.5 px-3 text-xs">Edit</button>
        </div>
      </StageCard>
    );
  }

  return (
    <StageCard step={1} title="Your product">
      <div className="space-y-4">
        <div>
          <label className="label">Company / product name</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Acme Analytics" autoFocus />
        </div>
        <div>
          <label className="label">Product URL <span className="text-slate-600 normal-case">(optional, helps find competitors)</span></label>
          <div className="flex gap-2">
            <input className="input flex-1" value={form.pricing_url} onChange={set('pricing_url')} placeholder="https://acme.com/pricing" />
            <button onClick={autofill} disabled={inferring || !form.pricing_url} className="btn-ghost shrink-0">
              <Icon name="sparkle" className={`h-4 w-4 ${inferring ? 'animate-spin' : ''}`} />
              {inferring ? 'Reading…' : 'Auto-fill'}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Details <span className="text-slate-600 normal-case">(optional)</span></label>
          <textarea className="input min-h-20 resize-y" value={form.description} onChange={set('description')}
            placeholder="What you do and who it's for. The more specific, the better the competitor matches." />
        </div>
        <div className="flex justify-end gap-2">
          {product && <button onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>}
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
            Save & continue
          </button>
        </div>
      </div>
    </StageCard>
  );
}

/* ──────────────────────── Stage 2: Competitors ──────────────────────── */
function normalizeUrl(u) {
  const t = (u || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}
function originOf(u) { try { return new URL(normalizeUrl(u)).origin; } catch { return null; } }

function CompetitorStage({ product, competitors, onChange }) {
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState(null); // pending confirmation list
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ name: '', pricing_url: '', notes: '' });
  const toast = useToast();

  const mergeCandidates = (incoming) => {
    setCandidates((prev) => {
      const list = prev || [];
      const seen = new Set(list.map((c) => c.pricing_url.toLowerCase()));
      const merged = [...list];
      for (const c of incoming) {
        const key = c.pricing_url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(c);
      }
      return merged;
    });
    setSelected((s) => ({ ...s, ...Object.fromEntries(incoming.map((c) => [c.pricing_url, true])) }));
  };

  const discover = async () => {
    setDiscovering(true);
    try {
      // Seed the query with already-known competitors (manual or approved) so the
      // agent finds *more like them*, not the same ones again.
      const known = [
        ...(candidates || []).map((c) => c.name),
        ...competitors.map((c) => c.name),
      ].filter(Boolean);
      const base = product.description || product.name;
      const description = known.length
        ? `${base}. Direct competitors already known: ${known.join(', ')}. Find additional similar competitors.`
        : base;

      const { candidates: found } = await api.discover({
        description,
        productUrl: product.pricing_url || '',
      });
      if (candidates === null) setCandidates([]); // enter build mode even if empty
      // Drop any the user already has approved.
      const approvedUrls = new Set(competitors.map((c) => (c.pricing_url || '').toLowerCase()));
      mergeCandidates((found || []).filter((c) => !approvedUrls.has(c.pricing_url.toLowerCase())));
      if (!found?.length) toast({ type: 'info', title: 'No new competitors found', message: 'Add product detail or enter one manually.' });
    } catch (err) {
      toast({ type: 'error', title: 'Discovery failed', message: err.message });
    } finally {
      setDiscovering(false);
    }
  };

  const addManual = () => {
    const url = normalizeUrl(manual.pricing_url);
    if (!manual.name.trim()) { toast({ type: 'error', title: 'Name is required' }); return; }
    if (!url) { toast({ type: 'error', title: 'URL is required' }); return; }
    if ((candidates || []).some((c) => c.pricing_url.toLowerCase() === url.toLowerCase())) {
      toast({ type: 'info', title: 'Already in the list' });
      return;
    }
    if (candidates === null) setCandidates([]);
    mergeCandidates([{
      name: manual.name.trim(),
      website: originOf(url),
      pricing_url: url,
      notes: manual.notes.trim() || 'Added manually',
      manual: true,
    }]);
    setManual({ name: '', pricing_url: '', notes: '' });
    setShowManual(false);
    toast({ type: 'success', title: 'Added — confirm below, or find more' });
  };

  const confirm = async () => {
    const chosen = (candidates || []).filter((c) => selected[c.pricing_url]);
    if (!chosen.length) { toast({ type: 'info', title: 'Select at least one' }); return; }
    setSaving(true);
    try {
      await api.addCompetitors(chosen, 'approved');
      const { competitors } = await api.listCompetitors('approved');
      onChange(competitors || []);
      setCandidates(null);
      setSelected({});
      toast({ type: 'success', title: `${chosen.length} competitor(s) saved` });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const removeOne = async (id) => {
    try {
      await api.deleteCompetitor(id);
      onChange(competitors.filter((c) => c.id !== id));
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove', message: err.message });
    }
  };

  const manualForm = (
    <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Competitor name *" value={manual.name}
          onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} autoFocus />
        <input className="input" placeholder="Pricing / website URL *" value={manual.pricing_url}
          onChange={(e) => setManual((m) => ({ ...m, pricing_url: e.target.value }))} />
      </div>
      <input className="input" placeholder="Short description (optional)" value={manual.notes}
        onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') addManual(); }} />
      <div className="flex justify-end gap-2">
        <button onClick={() => { setShowManual(false); setManual({ name: '', pricing_url: '', notes: '' }); }} className="btn-ghost py-1.5 px-3 text-xs">Cancel</button>
        <button onClick={addManual} className="btn-primary py-1.5 px-3 text-xs"><Icon name="plus" className="h-3.5 w-3.5" /> Add to list</button>
      </div>
    </div>
  );

  // Build/confirm mode — candidates exist (from discovery and/or manual)
  if (candidates !== null) {
    return (
      <StageCard step={2} title="Review & confirm competitors">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={discover} disabled={discovering} className="btn-ghost py-1.5 px-3 text-sm">
            <Icon name="search" className={`h-3.5 w-3.5 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Searching…' : 'Find more'}
          </button>
          {!showManual && (
            <button onClick={() => setShowManual(true)} className="btn-ghost py-1.5 px-3 text-sm">
              <Icon name="plus" className="h-3.5 w-3.5" /> Add manually
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {Object.values(selected).filter(Boolean).length} selected
          </span>
        </div>

        {showManual && <div className="mb-3">{manualForm}</div>}

        <div className="space-y-2">
          {candidates.length === 0 && !discovering && (
            <p className="rounded-lg border border-dashed border-ink-700 p-4 text-center text-sm text-slate-500">
              No competitors yet. Run “Find more” or add one manually above.
            </p>
          )}
          {discovering && candidates.length === 0 && (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          )}
          {candidates.map((c) => {
            const on = !!selected[c.pricing_url];
            return (
              <label key={c.pricing_url}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  on ? 'border-accent/50 bg-accent/5' : 'border-ink-700 bg-ink-850 opacity-70 hover:opacity-100'
                }`}>
                <input type="checkbox" checked={on}
                  onChange={(e) => setSelected((s) => ({ ...s, [c.pricing_url]: e.target.checked }))}
                  className="mt-1 h-4 w-4 accent-indigo-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{c.name}</span>
                    {c.manual && <span className="chip border-ink-600 bg-ink-800 text-slate-400 text-[10px]">manual</span>}
                  </div>
                  <a href={c.pricing_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                    className="block text-xs text-accent-soft hover:underline truncate">{c.pricing_url}</a>
                  {c.notes && <p className="mt-0.5 text-xs text-slate-500">{c.notes}</p>}
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => { setCandidates(null); setSelected({}); }} className="btn-ghost text-sm">Cancel</button>
          <button onClick={confirm} disabled={saving || candidates.length === 0} className="btn-primary">
            {saving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
            Confirm & save
          </button>
        </div>
      </StageCard>
    );
  }

  // Entry state — no competitors approved yet
  if (competitors.length === 0) {
    return (
      <StageCard step={2} title="Find competitors">
        <p className="text-sm text-slate-400">
          Search the web for the closest competitors to <strong className="text-slate-200">{product.name}</strong>,
          or add ones you already know — then confirm.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={discover} disabled={discovering} className="btn-primary">
            <Icon name="search" className={`h-4 w-4 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Searching…' : 'Find competitors'}
          </button>
          <button onClick={() => { setCandidates([]); setShowManual(true); }} className="btn-ghost">
            <Icon name="plus" className="h-4 w-4" /> Add manually
          </button>
        </div>
        {discovering && (
          <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        )}
      </StageCard>
    );
  }

  // Approved competitors
  return (
    <StageCard step={2} title="Competitors" done count={competitors.length}>
      <div className="flex flex-wrap gap-2">
        {competitors.map((c) => (
          <span key={c.id} className="group flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 py-1 pl-2.5 pr-1 text-sm text-slate-200">
            {c.name}
            {c.value_score != null && <span className="text-xs text-slate-500">{c.value_score}</span>}
            <button onClick={() => removeOne(c.id)} className="ml-0.5 rounded p-0.5 text-slate-600 hover:bg-ink-700 hover:text-rose-400 transition">
              <Icon name="x" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button onClick={discover} disabled={discovering} className="flex items-center gap-1 rounded-lg border border-dashed border-ink-600 px-2.5 py-1 text-sm text-slate-500 hover:text-slate-300 hover:border-ink-500 transition">
          <Icon name={discovering ? 'refresh' : 'search'} className={`h-3.5 w-3.5 ${discovering ? 'animate-spin' : ''}`} /> Find more
        </button>
        <button onClick={() => { setCandidates([]); setShowManual(true); }} className="flex items-center gap-1 rounded-lg border border-dashed border-ink-600 px-2.5 py-1 text-sm text-slate-500 hover:text-slate-300 hover:border-ink-500 transition">
          <Icon name="plus" className="h-3.5 w-3.5" /> Add manually
        </button>
      </div>
    </StageCard>
  );
}

/* ───────────────────────── Stage 3: Report ───────────────────────── */
function ReportStage({ competitors, onScored }) {
  const ids = competitors.map((c) => c.id);
  const [matrix, setMatrix] = useState(null);
  const [positioning, setPositioning] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [take, setTake] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [product, setProduct] = useState(null);
  const [market, setMarket] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketElapsed, setMarketElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const jobKey = () => `cia_market_job_${getWorkspace()?.id || 'x'}`;

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
    setMarketLoading(false);
    try { localStorage.removeItem(jobKey()); } catch {}
  };

  const beginPolling = (jobId, startedAt) => {
    try { localStorage.setItem(jobKey(), JSON.stringify({ jobId, startedAt })); } catch {}
    setMarketLoading(true);
    setMarketElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tickRef.current = setInterval(() => setMarketElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    const check = async () => {
      try {
        const { status, result, error } = await api.marketStatus(jobId);
        if (status === 'done') {
          stopPolling();
          if (result?.market) { setMarket(result.market); setSaved(false); toast({ type: 'success', title: 'Market intelligence ready' }); }
          else toast({ type: 'info', title: 'No market data found' });
        } else if (status === 'error') {
          stopPolling();
          toast({ type: 'error', title: 'Market research failed', message: error });
        }
      } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') {
          stopPolling();
          toast({ type: 'error', title: 'Market job expired', message: 'Please run it again.' });
        }
        // transient network errors: keep polling
      }
    };
    pollRef.current = setInterval(check, 5000);
    check();
  };

  const loadMarket = async () => {
    setSaved(false);
    try {
      const { jobId } = await api.marketStart();
      beginPolling(jobId, Date.now());
    } catch (err) {
      toast({ type: 'error', title: 'Could not start research', message: err.message });
    }
  };

  // Resume an in-flight market job after a refresh / navigation.
  useEffect(() => {
    let raw;
    try { raw = localStorage.getItem(jobKey()); } catch {}
    if (raw) {
      try {
        const { jobId, startedAt } = JSON.parse(raw);
        if (jobId) beginPolling(jobId, startedAt || Date.now());
      } catch {}
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAll = async () => {
    setRunning(true);
    setSaved(false);
    setMatrix(null); setPositioning(null); setReviews(null); setTake(null); setMarket(null); setProduct(null); setStrategy(null);
    try {
      // Score any unscored competitors first (so value comparison has data).
      setProgress('Scoring value-for-money…');
      await Promise.all(competitors.filter((c) => c.value_score == null).map((c) => api.valueScore(c.id).catch(() => {})));
      onScored?.();

      setProgress('Analyzing your product…');
      const pr = await api.productAnalysis().catch(() => null);
      if (pr?.product) setProduct(pr.product);

      setProgress('Building pricing & feature matrix…');
      const m = await api.featureMatrix(ids, true).catch(() => null);
      setMatrix(m);

      setProgress('Comparing business value…');
      const p = await api.positioning().catch(() => null);
      setPositioning(p?.analysis || null);

      setProgress('Building SWOT & positioning…');
      const s = await api.strategy().catch(() => null);
      setStrategy(s?.strategy || null);

      setProgress('Fetching user reviews…');
      const r = await api.reviews(ids).catch(() => null);
      setReviews(r?.reviews || []);

      setProgress('Writing analyst take…');
      const t = await api.analystTake().catch(() => null);
      setTake(t?.take || null);

      toast({ type: 'success', title: 'Analysis complete' });
    } catch (err) {
      toast({ type: 'error', title: 'Analysis failed', message: err.message });
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  const hasReport = matrix || positioning || reviews || take || strategy;

  const saveToHistory = async () => {
    setSaving(true);
    try {
      const snapshot = {
        competitors: competitors.map((c) => ({
          id: c.id, name: c.name, value_score: c.value_score ?? null,
          value_analysis: c.value_analysis ?? null, pricing_url: c.pricing_url ?? null,
        })),
        matrix, positioning, reviews, take, market, product, strategy,
        generatedAt: new Date().toISOString(),
      };
      const title = `Report · ${competitors.length} competitors · ${new Date().toLocaleDateString()}`;
      await api.saveReport(title, snapshot);
      setSaved(true);
      toast({ type: 'success', title: 'Saved to history', message: 'View it anytime under Reports — no re-run needed.' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StageCard step={3} title="Competitive report">
      {!hasReport && !running && (
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-slate-400">
            Generate a full breakdown: pricing & plans, feature matrix, business-value comparison, user-review sentiment, and an analyst take.
          </p>
          <button onClick={runAll} className="btn-primary">
            <Icon name="sparkle" className="h-4 w-4" /> Run full analysis
          </button>
        </div>
      )}

      {running && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-accent-soft">
            <Icon name="refresh" className="h-4 w-4 animate-spin" /> {progress}
          </div>
          <Skeleton className="h-40" />
        </div>
      )}

      {hasReport && (
        <div className="space-y-6">
          <ReportView competitors={competitors} matrix={matrix} positioning={positioning} reviews={reviews} take={take} market={market} product={product} strategy={strategy} />

          {/* Opt-in market intelligence (slow, finance research) */}
          {!market && !marketLoading && (
            <div className="rounded-xl border border-dashed border-ink-700 p-4 text-center">
              <p className="text-sm text-slate-400">
                Add <strong className="text-slate-200">market size, growth timeline, and competitor funding</strong> via deep finance research.
              </p>
              <button onClick={loadMarket} className="btn-ghost mt-3">
                <Icon name="trending" className="h-4 w-4" /> Add market intelligence
              </button>
              <p className="mt-2 text-xs text-slate-600">Deep research — takes ~2–3 minutes. Saved with the report so you only run it once.</p>
            </div>
          )}

          {marketLoading && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-accent-soft">
                <Icon name="refresh" className="h-4 w-4 animate-spin" />
                Researching market financials in the background…
                <span className="tabular-nums text-slate-400">{Math.floor(marketElapsed / 60)}:{String(marketElapsed % 60).padStart(2, '0')}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Deep finance research takes 2–3 minutes. You can navigate away — it keeps running and we'll
                notify you (and drop the results in here) when it's done.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-ink-800 pt-4">
            <button onClick={runAll} disabled={running || saving} className="btn-ghost text-sm">
              <Icon name="refresh" className="h-3.5 w-3.5" /> Regenerate
            </button>
            <button onClick={saveToHistory} disabled={saving || saved} className="btn-primary">
              {saved
                ? <><Icon name="check" className="h-4 w-4" /> Saved</>
                : saving
                  ? <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Saving…</>
                  : <><Icon name="share" className="h-4 w-4" /> Save to history</>}
            </button>
          </div>
        </div>
      )}
    </StageCard>
  );
}

/* ─────────────────────────── Shared bits ─────────────────────────── */
function StageCard({ step, title, children, done, count }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-emerald-600 text-white' : 'bg-accent text-white'
        }`}>
          {done ? <Icon name="check" className="h-3.5 w-3.5" /> : step}
        </div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {count != null && <span className="text-xs text-slate-500">· {count}</span>}
      </div>
      {children}
    </section>
  );
}

