'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Spinner, useToast } from './ui';
import { DistributionPanel } from './distribution/DistributionShared';
import { useMarketResearch } from '../hooks/useMarketResearch';
import { SkillChipRow, SourceAttribution } from './SourceAttribution';

const JOB_KEY = 'cia_marketmodel_job';
const FACT_KEY = 'cia_factcheck_job';

const VERDICT = {
  supported: { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: 'check', label: 'Supported' },
  mixed: { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', icon: 'alert', label: 'Mixed' },
  unsupported: { cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300', icon: 'x', label: 'Unsupported' },
};
const KIND_NOTE = {
  input: 'You set this, it is not a market statistic, so it will not appear in sources.',
  assumption: 'A derived estimate, not a published figure. Treat it as an assumption to defend.',
};
// Only 'market' claims are judged Supported/Unsupported. Inputs and derived
// assumptions get honest, non-alarming labels instead.
function badgeFor(c) {
  if (c.kind === 'input') return { cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300', icon: 'settings', label: 'Your input' };
  if (c.kind === 'assumption' && c.verdict !== 'supported') return { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', icon: 'alert', label: 'Assumption' };
  return VERDICT[c.verdict] || VERDICT.mixed;
}

function engineLabel(engine) {
  if (engine === 'tavily') return 'Tavily (independent search)';
  if (engine === 'youcom-search') return 'You.com web search';
  if (engine === 'youcom-research') return 'You.com research';
  if (engine === 'youcom-fallback') return 'You.com finance research (deep fallback)';
  return engine;
}

function fmtUSD(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '-';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
const pct = (v) => `${Math.round((Number(v) || 0) * 100)}%`;
const clamp = (v, min, max, d) => { const n = Number(v); if (!Number.isFinite(n)) return d; return Math.min(max, Math.max(min, n)); };

function normalizeClient(inp = {}) {
  return {
    geography: (typeof inp.geography === 'string' && inp.geography.trim()) ? inp.geography : 'Global',
    serviceable_pct: clamp(inp.serviceable_pct, 0, 1, 0.3),
    acv_usd: Math.max(0, Number(inp.acv_usd) || 1200),
    target_share: clamp(inp.target_share, 0, 1, 0.02),
    timeframe_years: clamp(Math.round(inp.timeframe_years), 1, 7, 3),
    annual_growth_pct: clamp(inp.annual_growth_pct, 0, 1, 0.3),
  };
}

// Mirror of the server's deterministic math so edits recompute instantly.
// SOM scales with pricing relative to the baseline ACV (raising ACV is a lever).
function derive(tam, inputs, baseAcv) {
  const t = Number(tam) || 0;
  const sam = Math.round(t * inputs.serviceable_pct);
  const acvFactor = baseAcv > 0 ? Math.max(0, inputs.acv_usd) / baseAcv : 1;
  const som = Math.round(sam * inputs.target_share * acvFactor);
  const T = inputs.timeframe_years;
  const som_timeline = Array.from({ length: T }, (_, i) => ({ year: i + 1, value_usd: Math.round((som * (i + 1)) / T) }));
  return { sam, som, som_timeline };
}

const CONF = {
  high: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

export default function MarketModelClient() {
  const toast = useToast();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [factOpen, setFactOpen] = useState(false);
  const [factBusy, setFactBusy] = useState(false);
  const [factErr, setFactErr] = useState('');
  const [pulseData, setPulseData] = useState(null);
  const pollRef = useRef(null);
  const saveRef = useRef(null);
  const factPollRef = useRef(null);
  const loadHistory = () => api.marketModelHistory().then((r) => setHistory(r.history || [])).catch(() => {});
  const loadPulse = () => api.marketPulse().then(setPulseData).catch(() => setPulseData(null));
  const { researching: distResearching, runResearch: runDistributionResearch } = useMarketResearch({
    onComplete: loadPulse,
  });

  function factPoll(jobId) {
    api.factCheckStatus(jobId)
      .then((res) => {
        if (res.status === 'done') {
          localStorage.removeItem(FACT_KEY);
          setFactBusy(false);
          if (res.result?.factCheck) setModel((m) => (m ? { ...m, fact_check: res.result.factCheck } : m));
        } else if (res.status === 'error') {
          localStorage.removeItem(FACT_KEY);
          setFactBusy(false);
          setFactErr(res.error || 'Fact-check failed.');
        } else {
          factPollRef.current = setTimeout(() => factPoll(jobId), 5000);
        }
      })
      .catch((err) => {
        if (/not found|expired|JOB_NOT_FOUND/i.test(err?.message || '')) { localStorage.removeItem(FACT_KEY); setFactBusy(false); return; }
        factPollRef.current = setTimeout(() => factPoll(jobId), 6000);
      });
  }

  async function applySourcedTam(value) {
    try {
      const { model: updated } = await api.applyTam(value);
      if (updated) setModel(updated);
    } catch (err) {
      toast({ type: 'error', title: 'Could not apply sourced TAM', message: err.message });
    }
  }

  async function reconcileBottomUp() {
    try {
      const { model: updated } = await api.reconcileBottomUp();
      if (updated) setModel(updated);
    } catch (err) {
      toast({ type: 'error', title: 'Could not reconcile model', message: err.message });
    }
  }

  async function runFactCheck() {
    setFactErr('');
    setFactBusy(true);
    setFactOpen(true);
    try {
      const { jobId } = await api.factCheckStart();
      localStorage.setItem(FACT_KEY, jobId);
      factPoll(jobId);
    } catch (e) {
      setFactBusy(false);
      setFactErr(e?.message || 'Could not start the fact-check.');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { model: saved } = await api.getMarketModel();
        if (saved) setModel(saved);
      } catch (err) {
        setError(err?.message || 'Could not load the saved market model.');
      }
      loadHistory();
      loadPulse();
      const jobId = typeof window !== 'undefined' ? localStorage.getItem(JOB_KEY) : null;
      if (jobId) { setBuilding(true); poll(jobId); }
      const factJob = typeof window !== 'undefined' ? localStorage.getItem(FACT_KEY) : null;
      if (factJob) { setFactBusy(true); factPoll(factJob); }
      setLoading(false);
    })();
    return () => { clearTimeout(pollRef.current); clearTimeout(factPollRef.current); };
  }, []);

  function poll(jobId) {
    api.marketModelStatus(jobId)
      .then((res) => {
        if (res.status === 'done') {
          localStorage.removeItem(JOB_KEY);
          setBuilding(false);
          if (res.result?.model) { setModel(res.result.model); loadHistory(); }
          else setError('The model came back empty. Try again, or check that your product is set up.');
        } else if (res.status === 'error') {
          localStorage.removeItem(JOB_KEY);
          setBuilding(false);
          setError(res.error || 'Market model failed.');
        } else {
          pollRef.current = setTimeout(() => poll(jobId), 5000);
        }
      })
      .catch((err) => {
        // Job gone/expired (e.g. after a restart), stop spinning; the saved model may still load.
        if (/not found|expired|JOB_NOT_FOUND/i.test(err?.message || '')) {
          localStorage.removeItem(JOB_KEY);
          setBuilding(false);
          return;
        }
        pollRef.current = setTimeout(() => poll(jobId), 6000);
      });
  }

  async function build() {
    setError('');
    setBuilding(true);
    try {
      const { jobId } = await api.marketModelStart();
      localStorage.setItem(JOB_KEY, jobId);
      poll(jobId);
    } catch (e) {
      setBuilding(false);
      setError(e?.message || 'Could not start. Make sure your product is set up first.');
    }
  }

  // Merge an assumptions patch → recompute locally now, persist (debounced).
  function applyInputs(patch) {
    setModel((m) => {
      if (!m) return m;
      const inputs = normalizeClient({ ...m.inputs, ...patch });
      const baseAcv = m.inputs_base?.acv_usd || m.inputs?.acv_usd;
      const d = derive(m.tam?.value_usd, inputs, baseAcv);
      const next = { ...m, inputs, sam: { ...m.sam, value_usd: d.sam }, som: { ...m.som, value_usd: d.som }, som_timeline: d.som_timeline };
      clearTimeout(saveRef.current);
      saveRef.current = setTimeout(() => {
        api.saveMarketModel(inputs).catch((err) => {
          setError(err?.message || 'Your assumption changes could not be saved.');
        });
      }, 700);
      return next;
    });
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Loading market model…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Market model</h1>
          <p className="mt-1 text-sm text-slate-400">TAM → SAM → SOM for your business. Every number is sourced or an editable assumption.</p>
          <SkillChipRow
            className="mt-3"
            size="md"
            skills={[{ skill: 'you-finance' }, { skill: 'tavily' }, { skill: 'grok' }]}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {model && (
            <button onClick={() => (model.fact_check ? setFactOpen(true) : runFactCheck())} disabled={factBusy} className="btn-ghost disabled:opacity-60">
              {factBusy ? <><Spinner /> Checking…</> : <><Icon name="shield" className="h-4 w-4" /> Fact-check</>}
            </button>
          )}
          <button onClick={build} disabled={building} className="btn-primary disabled:opacity-60">
            {building ? <><Spinner /> Building…</> : <><Icon name="refresh" className="h-4 w-4" /> {model ? 'Rebuild' : 'Build model'}</>}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</div>}

      {building && !model && (
        <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-6 text-sm text-slate-400">
          Researching your market and sizing TAM / SAM / SOM. This runs in the background (1–3 min), you can leave and come back.
        </div>
      )}

      {!model && !building && (
        <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-8 text-center">
          <p className="text-sm text-slate-400">No model yet. Build one to size your market and see your path from TAM to SOM.</p>
        </div>
      )}

      {model && (
        <ModelView
          model={model}
          history={history}
          pulseData={pulseData}
          onInputs={applyInputs}
          onReconcile={reconcileBottomUp}
          onRefreshDistribution={runDistributionResearch}
          distResearching={distResearching}
        />
      )}

      {factOpen && (
        <FactDrawer
          factCheck={model?.fact_check}
          currentTam={model?.tam?.value_usd}
          busy={factBusy}
          error={factErr}
          onRerun={runFactCheck}
          onApplyTam={applySourcedTam}
          onClose={() => setFactOpen(false)}
        />
      )}
    </div>
  );
}

// Right-side drawer: independent verification of the model's claims.
function FactDrawer({ factCheck, currentTam, busy, error, onRerun, onApplyTam, onClose }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const suggestTam = factCheck?.suggested_tam_usd;
  const showApply = suggestTam && currentTam && Math.abs(suggestTam - currentTam) / currentTam > 0.05;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onMouseDown={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fact-drawer-title" tabIndex={-1} className="relative flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon name="shield" className="h-4 w-4 text-accent-soft" />
            <h3 id="fact-drawer-title" className="text-sm font-semibold text-white">Fact-check</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-slate-500">
            An independent research pass re-checks each figure the model asserts, against fresh sources. Judge for yourself.
          </p>
          {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</div>}

          {busy && (
            <div className="mt-4 space-y-3" role="status" aria-label="Fact-checking">
              <p className="text-sm text-slate-400">Independently re-researching your claims…</p>
              <div className="space-y-2">
                <div className="shimmer h-4 w-2/5 rounded" />
                <div className="shimmer h-20 w-full rounded-xl" />
                <div className="shimmer h-16 w-full rounded-xl" />
              </div>
            </div>
          )}

          {!busy && !factCheck && !error && (
            <div className="mt-6 text-center text-sm text-slate-400">No fact-check yet.</div>
          )}

          {factCheck && (
            <div className="mt-4 space-y-3">
              {factCheck.overall && (
                <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-xs leading-relaxed text-slate-300">{factCheck.overall}</div>
              )}
              {showApply && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3">
                  <span className="text-xs text-slate-200">Sources point to TAM ≈ <b>{fmtUSD(suggestTam)}</b></span>
                  <button onClick={() => onApplyTam(suggestTam)} className="btn-primary py-1 px-2.5 text-xs">Apply</button>
                </div>
              )}
              {(factCheck.checks || []).map((c, i) => {
                const v = badgeFor(c);
                return (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white">{c.claim}</p>
                      <span className={`chip shrink-0 ${v.cls}`}><Icon name={v.icon} className="h-3 w-3" /> {v.label}</span>
                    </div>
                    {c.finding && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{c.finding}</p>}
                    {KIND_NOTE[c.kind] && <p className="mt-1 text-[11px] text-slate-600">{KIND_NOTE[c.kind]}</p>}
                    {c.confidence && c.kind === 'market' && <p className="mt-1 text-[11px] text-slate-600">Checker confidence: {c.confidence}</p>}
                  </div>
                );
              })}

              <SourceAttribution
                attribution={factCheck.attribution}
                sources={factCheck.sources}
                skill={factCheck.skill}
                skillLabel={factCheck.skillLabel}
                engine={factCheck.engine}
              />
              {factCheck.checkedAt && <p className="pt-1 text-[11px] text-slate-600">Checked {new Date(factCheck.checkedAt).toLocaleString()}</p>}
            </div>
          )}
        </div>

        <div className="border-t border-ink-800 px-5 py-3">
          <button onClick={onRerun} disabled={busy} className="btn-ghost w-full justify-center disabled:opacity-60">
            {busy ? <><Spinner /> Checking…</> : <><Icon name="refresh" className="h-4 w-4" /> {factCheck ? 'Re-run fact-check' : 'Run fact-check'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compare the two most recent build snapshots.
function ChangeCard({ history }) {
  if (!history || history.length < 2) return null;
  const cur = history[0], prev = history[1];
  const when = prev.created_at ? new Date(prev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'last build';
  const rows = [['TAM', cur.tam, prev.tam], ['SAM', cur.sam, prev.sam], ['SOM', cur.som, prev.som]];
  const any = rows.some(([, c, p]) => Number(c) !== Number(p));
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <h3 className="text-sm font-semibold text-white">What changed</h3>
      <p className="mt-0.5 text-xs text-slate-500">Versus your previous model, built {when}.</p>
      {!any ? (
        <p className="mt-3 text-sm text-slate-400">No change since your last build.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {rows.map(([label, c, p]) => {
            const delta = (Number(c) || 0) - (Number(p) || 0);
            const pctChg = p ? (delta / p) * 100 : 0;
            const up = delta > 0, flat = delta === 0;
            return (
              <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-base font-semibold text-white">{fmtUSD(c)}</p>
                <p className={`text-[11px] ${flat ? 'text-slate-500' : up ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {flat ? 'no change' : `${up ? '▲' : '▼'} ${fmtUSD(Math.abs(delta))} (${up ? '+' : ''}${pctChg.toFixed(0)}%)`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelView({ model, history, pulseData, onInputs, onReconcile, onRefreshDistribution, distResearching }) {
  const blowout = model.bottom_up?.value_usd && model.tam?.value_usd && model.bottom_up.value_usd > model.tam.value_usd * 3;
  const tam = model.tam || {};
  const inputs = model.inputs || {};
  const base = model.inputs_base || inputs;
  const tamValue = tam.value_usd;
  const currentSom = model.som?.value_usd || 0;
  const [copied, setCopied] = useState(false);
  const [aiScenarios, setAiScenarios] = useState(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const toast = useToast();

  const edited = useMemo(() => (
    ['serviceable_pct', 'target_share', 'acv_usd', 'timeframe_years', 'annual_growth_pct', 'geography']
      .some((k) => String(base[k]) !== String(inputs[k]))
  ), [base, inputs]);

  const rows = [
    { key: 'TAM', label: 'Total Addressable Market', value: tamValue, sub: tam.method, width: 100, tone: 'from-accent/30 to-accent/10' },
    { key: 'SAM', label: 'Serviceable Addressable Market', value: model.sam?.value_usd, sub: model.sam?.method, width: 62, tone: 'from-indigo-400/30 to-indigo-400/10' },
    { key: 'SOM', label: 'Serviceable Obtainable Market', value: currentSom, sub: model.som?.method, width: 32, tone: 'from-violet-400/40 to-violet-400/10' },
  ];
  const maxTimeline = Math.max(1, ...(model.som_timeline || []).map((p) => p.value_usd));

  // Scenario presets (from the researched baseline).
  const scenarios = [
    { key: 'Conservative', patch: { serviceable_pct: clamp(base.serviceable_pct * 0.7, 0, 1), target_share: clamp(base.target_share * 0.5, 0, 0.5) } },
    { key: 'Base', patch: { serviceable_pct: base.serviceable_pct, target_share: base.target_share } },
    { key: 'Aggressive', patch: { serviceable_pct: clamp(base.serviceable_pct * 1.3, 0, 1), target_share: clamp(base.target_share * 2, 0, 0.5) } },
  ].map((s) => ({ ...s, som: derive(tamValue, normalizeClient({ ...base, ...s.patch }), base.acv_usd).som }));

  const runAiScenarios = async () => {
    setScenarioBusy(true);
    try {
      const { result } = await api.generateMarketScenarios({
        tam: tamValue,
        sam: model.sam?.value_usd,
        som: currentSom,
        inputs,
      });
      setAiScenarios(result);
    } catch (err) {
      toast({ type: 'error', title: 'Scenarios failed', message: err.message });
    } finally {
      setScenarioBusy(false);
    }
  };

  function leverPatch(l) {
    const imp = l.impact;
    if (imp && imp.input && imp.to != null && ['serviceable_pct', 'target_share', 'acv_usd'].includes(imp.input)) {
      return { [imp.input]: Number(imp.to) };
    }
    if (l.target_layer === 'SAM') return { serviceable_pct: clamp((inputs.serviceable_pct || 0.3) * 1.5, 0, 1) };
    if (l.target_layer === 'ACV') return { acv_usd: Math.round((inputs.acv_usd || 1200) * 2) };
    return { target_share: clamp((inputs.target_share || 0.02) * 1.75, 0, 0.5) };
  }

  function copySummary() {
    const lines = [
      `Market model${inputs.geography ? `: ${inputs.geography}` : ''}`,
      `TAM: ${fmtUSD(tamValue)}${tam.low_usd || tam.high_usd ? ` (range ${fmtUSD(tam.low_usd)}–${fmtUSD(tam.high_usd)})` : ''}${tam.confidence ? ` · confidence ${tam.confidence}` : ''}`,
      `SAM: ${fmtUSD(model.sam?.value_usd)} (serviceable ${pct(inputs.serviceable_pct)} of TAM)`,
      `SOM: ${fmtUSD(currentSom)} (obtainable ${pct(inputs.target_share)} of SAM over ${inputs.timeframe_years}yr)`,
      `Path to SOM: ${(model.som_timeline || []).map((p) => `Yr${p.year} ${fmtUSD(p.value_usd)}`).join(', ')}`,
      model.summary ? `\n${model.summary}` : '',
      (model.sources || []).length ? `\nSources:\n${model.sources.map((s) => `- ${s.title || s.url}: ${s.url}`).join('\n')}` : '',
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }

  function exportInvestorPDF() {
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const dist = pulseData?.distribution;
    const insights = pulseData?.insights || [];
    const items = (dist?.items || []).slice(0, 8);
    const maxP = Math.max(1, ...items.map((i) => i.presence_pct ?? i.share_pct ?? 0));
    const presenceRows = items.map((item, i) => {
      const pct = item.presence_pct ?? item.share_pct ?? 0;
      return `<tr><td>${esc(item.name)}</td><td style="text-align:right;font-weight:700">${pct}%</td><td><div style="background:#e2e8f0;border-radius:4px;height:8px;"><div style="width:${Math.max(6, (pct / maxP) * 100)}%;height:8px;border-radius:4px;background:${['#6366f1','#818cf8','#a5b4fc','#c7d2fe'][i % 4]}"></div></div></td></tr>`;
    }).join('');
    const insightList = insights.filter((x) => x.type !== 'missing').map((ins) => `<li><b>${esc(ins.title)}</b>: ${esc(ins.body)}</li>`).join('');
    const moves = (model.levers || []).slice(0, 3).map((l) => `<li><b>${esc(l.lever)}</b>${l.effect ? `: ${esc(l.effect)}` : ''}</li>`).join('');
    const sources = (model.sources || []).map((s) => `<li><a href="${esc(s.url)}">${esc(s.title || s.url)}</a></li>`).join('');
    const funnel = [
      ['TAM', fmtUSD(tamValue), tam.method],
      ['SAM', fmtUSD(model.sam?.value_usd), model.sam?.method],
      ['SOM', fmtUSD(currentSom), model.som?.method],
    ].map(([k, v, sub]) => `<tr><td class="k">${k}</td><td class="v">${v}</td><td class="s">${esc(sub || '')}</td></tr>`).join('');

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Investor brief: Market model</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Inter, sans-serif; color:#0f172a; max-width:720px; margin:40px auto; padding:0 28px; line-height:1.5; }
  .brand { font-weight:800; letter-spacing:-.02em; font-size:20px; }
  .brand span { color:#6366f1; }
  h1 { font-size:26px; margin:18px 0 2px; }
  .muted { color:#64748b; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin:14px 0; }
  td { padding:8px; border-bottom:1px solid #e2e8f0; font-size:13px; vertical-align:middle; }
  td.k { font-weight:700; width:52px; }
  td.v { text-align:right; font-weight:800; white-space:nowrap; }
  td.s { color:#64748b; font-size:12px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.08em; color:#475569; margin:26px 0 6px; }
  ul { margin:6px 0; padding-left:18px; font-size:13px; }
  .disclaimer { font-size:11px; color:#64748b; margin-top:24px; padding-top:12px; border-top:1px solid #e2e8f0; }
  a { color:#4f46e5; text-decoration:none; }
  @media print { body { margin:0; } }
</style></head><body>
  <div class="brand">Mira</div>
  <h1>Investor market brief</h1>
  <div class="muted">${esc(inputs.geography || 'Global')} · ${new Date().toLocaleDateString()} · Directional estimates</div>
  ${model.summary ? `<p style="margin-top:14px;font-size:14px">${esc(model.summary)}</p>` : ''}
  <h2>Market funnel</h2>
  <table>${funnel}</table>
  ${dist ? `<h2>Estimated competitor presence${dist.cr4_pct != null ? ` · CR4 ≈ ${dist.cr4_pct}%` : ''}</h2>
  <table>${presenceRows}</table>
  <p class="muted">${esc(dist.disclaimer || 'Directional estimates, not syndicated market share.')}</p>` : '<p class="muted">Run market intelligence to populate competitor presence.</p>'}
  ${insightList ? `<h2>Market insights</h2><ul>${insightList}</ul>` : ''}
  ${moves ? `<h2>Recommended levers</h2><ul>${moves}</ul>` : ''}
  ${sources ? `<h2>Sources</h2><ul>${sources}</ul>` : ''}
  <p class="disclaimer">This brief combines your workspace market model with estimated competitor presence from live research. Figures are hypotheses to defend, not audited market share. See methodology in Mira.</p>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  function exportPDF() {
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const timeline = (model.som_timeline || []).map((p) => `Yr ${p.year}: <b>${fmtUSD(p.value_usd)}</b>`).join(' &nbsp;·&nbsp; ');
    const levers = (model.levers || []).map((l) => `<li><b>${esc(l.lever)}</b> <span class="tag">${esc(l.target_layer || 'SOM')}</span>${l.effect ? `: ${esc(l.effect)}` : ''}</li>`).join('');
    const sources = (model.sources || []).map((s) => `<li><a href="${esc(s.url)}">${esc(s.title || s.url)}</a></li>`).join('');
    const funnel = [
      ['TAM', 'Total Addressable Market', model.tam?.value_usd, model.tam?.method],
      ['SAM', 'Serviceable Addressable Market', model.sam?.value_usd, model.sam?.method],
      ['SOM', 'Serviceable Obtainable Market', currentSom, model.som?.method],
    ].map(([k, label, v, sub]) => `<tr><td class="k">${k}</td><td>${esc(label)}</td><td class="v">${fmtUSD(v)}</td><td class="s">${esc(sub || '')}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Market model</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Inter, sans-serif; color:#0f172a; max-width:720px; margin:40px auto; padding:0 28px; line-height:1.5; }
  .brand { font-weight:800; letter-spacing:-.02em; font-size:20px; }
  .brand span { color:#6366f1; }
  h1 { font-size:26px; margin:18px 0 2px; }
  .muted { color:#64748b; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin:14px 0; }
  td { padding:10px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; font-size:14px; }
  td.k { font-weight:700; width:52px; }
  td.v { text-align:right; font-weight:800; white-space:nowrap; }
  td.s { color:#64748b; font-size:12px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.08em; color:#475569; margin:26px 0 6px; }
  ul { margin:6px 0; padding-left:18px; font-size:13px; }
  .tag { font-size:10px; background:#eef2ff; color:#4338ca; padding:1px 6px; border-radius:999px; margin-left:4px; }
  .box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; font-size:13px; }
  a { color:#4f46e5; text-decoration:none; }
  @media print { body { margin:0; } }
</style></head><body>
  <div class="brand">Mira</div>
  <h1>Market model</h1>
  <div class="muted">${esc(inputs.geography || 'Global')} · TAM confidence: ${esc(model.tam?.confidence || 'n/a')} · ${new Date().toLocaleDateString()}</div>
  ${model.summary ? `<p class="box" style="margin-top:14px">${esc(model.summary)}</p>` : ''}
  <table>${funnel}</table>
  ${(model.tam?.low_usd || model.tam?.high_usd) ? `<div class="muted">TAM range: ${fmtUSD(model.tam.low_usd)} – ${fmtUSD(model.tam.high_usd)}</div>` : ''}
  <h2>Assumptions</h2>
  <div class="box">Serviceable share of TAM: ${pct(inputs.serviceable_pct)} &nbsp;·&nbsp; Obtainable share of SAM: ${pct(inputs.target_share)} &nbsp;·&nbsp; ACV: ${fmtUSD(inputs.acv_usd)} &nbsp;·&nbsp; Timeframe: ${inputs.timeframe_years}yr &nbsp;·&nbsp; Market growth: ${pct(inputs.annual_growth_pct)}/yr</div>
  <h2>Path to SOM</h2>
  <div class="muted">${timeline}</div>
  ${model.reconciliation ? `<h2>Top-down vs bottom-up</h2><div class="box">${esc(model.reconciliation)}</div>` : ''}
  ${levers ? `<h2>Levers to grow SOM</h2><ul>${levers}</ul>` : ''}
  ${sources ? `<h2>Sources</h2><ul>${sources}</ul>` : ''}
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="mt-6 space-y-5">
      {model.summary && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <p className="text-sm leading-relaxed text-slate-200">{model.summary}</p>
        </div>
      )}

      <ChangeCard history={history} />

      {/* Funnel */}
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">TAM → SAM → SOM</span>
          <div className="flex items-center gap-2">
            <button onClick={copySummary} className="btn-ghost py-1 px-2.5 text-xs">
              <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy summary'}
            </button>
            <button onClick={exportPDF} className="btn-ghost py-1 px-2.5 text-xs">
              <Icon name="download" className="h-3.5 w-3.5" /> Model PDF
            </button>
            <button onClick={exportInvestorPDF} className="btn-ghost py-1 px-2.5 text-xs">
              <Icon name="share" className="h-3.5 w-3.5" /> Investor brief
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className={`relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-r ${r.tone} p-4`} style={{ width: `${r.width}%`, minWidth: 260 }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{r.key}</span>
                  <span className="ml-2 text-[11px] text-slate-500">{r.label}</span>
                </div>
                <span className="text-xl font-bold tabular-nums text-white">{fmtUSD(r.value)}</span>
              </div>
              {r.key === 'TAM' && (tam.low_usd || tam.high_usd) && (
                <p className="mt-1 text-[11px] text-slate-500">Range {fmtUSD(tam.low_usd)} – {fmtUSD(tam.high_usd)}</p>
              )}
              {r.sub && <p className="mt-0.5 text-[11px] text-slate-500">{r.sub}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {tam.confidence && <span className={`chip ${CONF[tam.confidence] || CONF.low}`}>Confidence: {tam.confidence}</span>}
          {tam.sourced === true && <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><Icon name="check" className="h-3 w-3" /> Sourced</span>}
          {tam.sourced === false && <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300"><Icon name="alert" className="h-3 w-3" /> Assumption</span>}
          <span className="text-[11px] text-slate-500">SAM &amp; SOM recompute from your assumptions.</span>
        </div>
        {tam.source_quote && <p className="mt-1.5 text-[11px] italic text-slate-500">“{tam.source_quote}”</p>}
      </div>

      <DistributionPanel
        pulseData={pulseData}
        tamContext={{
          tamValue,
          somValue: currentSom,
          targetSharePct: `${Math.round((inputs.target_share || 0) * 100)}%`,
        }}
        compact
        showRefresh
        onRefresh={onRefreshDistribution}
        researching={distResearching}
        showSyndicated
        showFullLink
        showPricingChanges={false}
      />

      {!pulseData?.distribution?.items?.length && (
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-sm text-slate-400">
          No distribution yet.{' '}
          <button type="button" onClick={onRefreshDistribution} disabled={distResearching} className="text-accent-soft underline">
            Run market research
          </button>{' '}
          or open the{' '}
          <a href="/distribution" className="text-accent-soft underline">Distribution</a> page.
        </div>
      )}

      {/* Scenarios */}
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Scenarios</h3>
            <p className="mt-0.5 text-xs text-slate-500">Compare obtainable market under different assumptions. Click to apply.</p>
          </div>
          <button onClick={runAiScenarios} disabled={scenarioBusy} className="btn-ghost py-1 px-2.5 text-xs shrink-0">
            {scenarioBusy ? <Spinner /> : <Icon name="sparkle" className="h-3.5 w-3.5" />}
            {scenarioBusy ? 'Building…' : 'AI bull/base/bear'}
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {scenarios.map((s) => {
            const active = Math.round(s.som) === Math.round(currentSom);
            return (
              <button key={s.key} onClick={() => onInputs(s.patch)} className={`rounded-xl border p-4 text-left transition ${active ? 'border-accent/50 bg-accent/10' : 'border-white/5 bg-white/[0.02] hover:border-white/15'}`}>
                <p className="text-xs font-medium text-slate-400">{s.key}</p>
                <p className="mt-1 text-lg font-bold text-white">{fmtUSD(s.som)}</p>
                <p className="text-[11px] text-slate-500">SOM · {pct(s.patch.target_share)} of SAM</p>
              </button>
            );
          })}
        </div>
        {aiScenarios?.scenarios?.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-ink-800 pt-4">
            <p className="text-xs text-slate-400">{aiScenarios.narrative}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {aiScenarios.scenarios.map((s) => (
                <div key={s.name} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.name} · {Math.round((s.probability || 0) * 100)}%</p>
                  <p className="mt-1 text-sm font-semibold text-white">SOM {fmtUSD(s.somUsd)}</p>
                  <p className="text-[11px] text-slate-500">TAM {fmtUSD(s.tamUsd)} · SAM {fmtUSD(s.samUsd)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Editable assumptions */}
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Your assumptions</h3>
          {edited && (
            <button onClick={() => onInputs({ ...base })} className="chip border-ink-600 bg-ink-850 text-slate-300 hover:text-white">
              <Icon name="refresh" className="h-3 w-3" /> Reset to baseline
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Edit these to make the model yours. SAM and SOM update instantly.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Geography">
            <input value={inputs.geography || ''} onChange={(e) => onInputs({ geography: e.target.value })} className="input" />
          </Field>
          <Field label={`Serviceable share of TAM: ${pct(inputs.serviceable_pct)}`}>
            <input type="range" min="0" max="1" step="0.01" value={inputs.serviceable_pct} onChange={(e) => onInputs({ serviceable_pct: Number(e.target.value) })} className="w-full accent-indigo-500" />
          </Field>
          <Field label={`Obtainable share of SAM: ${pct(inputs.target_share)}`}>
            <input type="range" min="0" max="0.5" step="0.005" value={inputs.target_share} onChange={(e) => onInputs({ target_share: Number(e.target.value) })} className="w-full accent-indigo-500" />
          </Field>
          <Field label="Annual value per customer (ACV)">
            <input type="number" value={inputs.acv_usd} onChange={(e) => onInputs({ acv_usd: Number(e.target.value) })} className="input" />
          </Field>
          <Field label="Timeframe (years)">
            <input type="number" min="1" max="7" value={inputs.timeframe_years} onChange={(e) => onInputs({ timeframe_years: Number(e.target.value) })} className="input" />
          </Field>
          <Field label={`Market growth: ${pct(inputs.annual_growth_pct)} / yr`}>
            <input type="range" min="0" max="1" step="0.01" value={inputs.annual_growth_pct} onChange={(e) => onInputs({ annual_growth_pct: Number(e.target.value) })} className="w-full accent-indigo-500" />
          </Field>
        </div>
      </div>

      {/* Bottom-up + reconciliation */}
      {(model.bottom_up || model.reconciliation) && (
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h3 className="text-sm font-semibold text-white">Cross-check: bottom-up</h3>
          {model.bottom_up && (
            <>
              <div className="mt-2 flex flex-wrap gap-5 text-sm">
                <StatTag label="ICP customers" value={model.bottom_up.customers ? Number(model.bottom_up.customers).toLocaleString() : '-'} tag={model.bottom_up.customers_sourced ? 'Sourced' : 'Assumption'} tone={model.bottom_up.customers_sourced ? 'emerald' : 'amber'} />
                <StatTag label="× ACV" value={fmtUSD(model.bottom_up.acv_usd)} tag="Your input" tone="slate" />
                <StatTag label="= Bottom-up estimate" value={fmtUSD(model.bottom_up.value_usd)} tag="Your estimate" tone="slate" />
              </div>
              <p className="mt-2.5 text-[11px] text-slate-500">This multiplies your own assumptions, so it's a sanity-check of your logic, not an independent source.</p>
              {blowout && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-950/25 p-3">
                  <span className="text-xs text-rose-200">
                    Bottom-up is {(model.bottom_up.value_usd / model.tam.value_usd).toFixed(1)}× the sourced TAM, so your customer count looks too optimistic.
                  </span>
                  <button onClick={onReconcile} className="btn-ghost shrink-0 py-1 px-2.5 text-xs">Reconcile to TAM</button>
                </div>
              )}
            </>
          )}
          {model.reconciliation && <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-200/90">{model.reconciliation}</p>}
        </div>
      )}

      {/* SOM timeline */}
      {(model.som_timeline || []).length > 0 && (
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h3 className="text-sm font-semibold text-white">Path to SOM</h3>
          <p className="mt-0.5 text-xs text-slate-500">Ramp toward your obtainable market over {inputs.timeframe_years} years.</p>
          <div className="mt-4 flex items-end gap-4">
            {model.som_timeline.map((p) => (
              <div key={p.year} className="flex flex-1 flex-col items-center">
                <span className="mb-1.5 text-[11px] font-medium text-slate-300">{fmtUSD(p.value_usd)}</span>
                <div className="flex w-full items-end justify-center" style={{ height: 120 }}>
                  <div className="w-full max-w-[72px] rounded-t-md bg-gradient-to-t from-accent/40 to-accent" style={{ height: `${Math.max(4, (p.value_usd / maxTimeline) * 100)}%` }} />
                </div>
                <span className="mt-2 text-[11px] text-slate-500">Yr {p.year}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth levers, quantified + applyable */}
      {(model.levers || []).length > 0 && (
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h3 className="text-sm font-semibold text-white">Levers to grow SOM</h3>
          <p className="mt-0.5 text-xs text-slate-500">Each shows the projected SOM lift. Apply one to update your model.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {model.levers.map((l, i) => {
              const patch = leverPatch(l);
              const projected = derive(tamValue, normalizeClient({ ...inputs, ...patch }), base.acv_usd).som;
              const delta = projected - currentSom;
              return (
                <div key={i} className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <span className="chip border-accent/30 bg-accent/10 text-accent-soft">{l.target_layer || 'SOM'}</span>
                    <span className="text-sm font-semibold text-white">{l.lever}</span>
                  </div>
                  {l.effect && <p className="mt-1.5 text-xs text-slate-400">{l.effect}</p>}
                  {l.requires && <p className="mt-1 text-[11px] text-slate-500">Requires: {l.requires}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {delta > 0 ? `+${fmtUSD(delta)} SOM` : 'No change'}
                    </span>
                    <button onClick={() => onInputs(patch)} disabled={delta === 0} className="btn-ghost py-1 px-2.5 text-xs disabled:opacity-40">Apply</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sources + You.com skill */}
      {(model.sources?.length || model.attribution) && (
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h3 className="text-sm font-semibold text-white">Sources</h3>
          <SourceAttribution
            className="mt-1 border-0 pt-0"
            attribution={model.attribution}
            sources={model.sources}
            skill={model.skill || 'you-finance'}
            skillLabel={model.skillLabel || 'You.com Finance'}
            engine={model.engine}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
function Stat({ label, value }) {
  return (
    <div>
      <p className="text-base font-semibold text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
function StatTag({ label, value, tag, tone }) {
  const cls = tone === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : 'border-ink-600 bg-ink-850 text-slate-400';
  return (
    <div>
      <p className="text-base font-semibold text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
      {tag && <span className={`chip mt-1 ${cls}`}>{tag}</span>}
    </div>
  );
}
