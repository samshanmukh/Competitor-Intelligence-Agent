'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace } from '../lib/auth';
import { CompanyLogo, Icon, Shimmer, Skeleton, useToast } from './ui';
import ReportView from './ReportView';
export default function AnalyzeClient() {
  const [product, setProduct] = useState(undefined); // undefined = loading, null = none
  const [competitors, setCompetitors] = useState(null);
  // null = not chosen yet; after setup completes we default to collapsed
  const [setupOpen, setSetupOpen] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const [{ product }, { competitors }] = await Promise.all([
        api.getProduct().catch(() => ({ product: null })),
        api.listCompetitors('approved').catch(() => ({ competitors: [] })),
      ]);
      const list = competitors || [];
      setProduct(product);
      setCompetitors(list);
      // Expanded while setting up; collapse once product + competitors exist.
      setSetupOpen(!(product && list.length > 0));
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load', message: err.message });
      setProduct(null);
      setCompetitors([]);
      setSetupOpen(true);
    }
  };

  useEffect(() => { load(); api.recordVisit().catch(() => {}); }, []);

  const ready = Boolean(product && competitors?.length > 0);

  // If competitors are cleared later, force the setup panel open again.
  useEffect(() => {
    if (!ready && product !== undefined && competitors !== null) setSetupOpen(true);
  }, [ready, product, competitors]);

  if (product === undefined || competitors === null) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const open = Boolean(setupOpen) || !ready;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="glass-nav flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-white">Analysis</h1>
          <p className="truncate text-xs text-slate-500">
            {ready
              ? `${product.name} · ${competitors.length} competitor${competitors.length === 1 ? '' : 's'}`
              : 'Set up your product and competitors in the right panel'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {product && (
            <div className="hidden items-center gap-2 sm:flex">
              <CompanyLogo
                name={product.name}
                website={product.website}
                pricing_url={product.pricing_url}
                className="h-8 w-8 rounded-lg"
                textClassName="text-xs text-accent-soft"
              />
              <span className="text-sm font-medium text-slate-200">{product.name}</span>
            </div>
          )}
          {ready && (
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              className="btn-ghost px-3 py-1.5 text-xs"
              aria-expanded={open}
              aria-controls="analysis-setup-sidebar"
            >
              <Icon name={open ? 'chevronRight' : 'settings'} className="h-3.5 w-3.5" />
              {open ? 'Hide setup' : 'Edit setup'}
            </button>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Main report canvas, full width */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {!product && (
            <EmptyCanvas
              icon="sparkle"
              title="Start with your product"
              body="Use the setup panel on the right to add your company name and URL, then find competitors."
              action={!open ? (
                <button type="button" onClick={() => setSetupOpen(true)} className="btn-primary mt-5">
                  Open setup
                </button>
              ) : null}
            />
          )}
          {product && competitors.length === 0 && (
            <EmptyCanvas
              icon="search"
              title="Add competitors next"
              body="Find or add at least one competitor in the right panel, then the report opens here."
              action={!open ? (
                <button type="button" onClick={() => setSetupOpen(true)} className="btn-primary mt-5">
                  Open setup
                </button>
              ) : null}
            />
          )}
          {ready && (
            <ReportStage competitors={competitors} onScored={load} />
          )}
        </section>

        {/* Right setup sidebar, expandable after product + competitors are set */}
        <SetupSidebar
          open={open}
          canCollapse={ready}
          onOpen={() => setSetupOpen(true)}
          onClose={() => setSetupOpen(false)}
          product={product}
          competitors={competitors}
          onProductSaved={(p) => setProduct(p)}
          onCompetitorsChange={(list) => setCompetitors(list)}
        />
      </div>
    </div>
  );
}

function SetupSidebar({
  open,
  canCollapse,
  onOpen,
  onClose,
  product,
  competitors,
  onProductSaved,
  onCompetitorsChange,
}) {
  // Collapsed strip (desktop), still shows company + count, expands on click
  if (!open && canCollapse) {
    return (
      <aside className="glass-nav hidden w-14 shrink-0 flex-col items-center border-l py-3 md:flex">
        <button
          type="button"
          onClick={onOpen}
          title="Edit product & competitors"
          aria-label="Expand setup sidebar"
          className="flex flex-col items-center gap-3 rounded-xl px-1 py-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <CompanyLogo
            name={product.name}
            website={product.website}
            pricing_url={product.pricing_url}
            className="h-9 w-9 rounded-lg"
            textClassName="text-xs text-accent-soft"
          />
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
            {competitors.length}
          </span>
          <Icon name="chevronLeft" className="h-3.5 w-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile overlay when open */}
      {open && canCollapse && (
        <button
          type="button"
          aria-label="Close setup"
          className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="analysis-setup-sidebar"
        className={`glass-nav z-30 flex shrink-0 flex-col border-l transition-[width,transform] duration-200 ${
          open
            ? 'absolute inset-y-0 right-0 w-[min(100%,22rem)] shadow-2xl md:static md:w-[22rem] md:shadow-none xl:w-96'
            : 'hidden'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Setup</p>
            <p className="truncate text-sm font-medium text-white">
              {product?.name || 'Your product & competitors'}
            </p>
          </div>
          {canCollapse && (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-2 py-1.5"
              aria-label="Collapse setup sidebar"
              title="Collapse"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <ProductStage product={product} onSaved={onProductSaved} compact />
          {product && (
            <CompetitorStage
              product={product}
              competitors={competitors}
              onChange={onCompetitorsChange}
              compact
            />
          )}
        </div>
      </aside>
    </>
  );
}

function EmptyCanvas({ icon, title, body, action }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-accent-soft">
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
        {action}
      </div>
    </div>
  );
}

/* ─────────────────────────── Stage 1: Product ─────────────────────────── */
function ProductStage({ product, onSaved, compact }) {
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
      <Panel title="Your product" done>
        <div className="flex items-start gap-3">
          <CompanyLogo
            name={product.name}
            website={product.website}
            pricing_url={product.pricing_url}
            className="h-9 w-9 rounded-lg"
            textClassName="text-sm text-accent-soft"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{product.name}</h3>
              <button onClick={() => setEditing(true)} className="btn-ghost shrink-0 px-2 py-1 text-[11px]">Edit</button>
            </div>
            {product.pricing_url && (
              <a href={product.pricing_url} target="_blank" rel="noreferrer"
                className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-accent-soft hover:underline">
                {product.pricing_url} <Icon name="external" className="h-3 w-3 shrink-0" />
              </a>
            )}
            {product.description && (
              <>
                <p className={`mt-1.5 text-xs text-slate-400 whitespace-pre-line ${expanded ? '' : 'line-clamp-2'}`}>
                  {product.description}
                </p>
                {product.description.length > 100 && (
                  <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-[11px] text-accent-soft hover:text-white">
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Your product">
      <div className="space-y-3">
        <div>
          <label htmlFor="analysis-product-name" className="label">Company / product name</label>
          <input id="analysis-product-name" className="input" value={form.name} onChange={set('name')} placeholder="Acme Analytics" autoFocus={!compact || !product} />
        </div>
        <div>
          <label htmlFor="analysis-product-url" className="label">Product URL</label>
          <div className="flex gap-2">
            <input id="analysis-product-url" className="input flex-1" value={form.pricing_url} onChange={set('pricing_url')} placeholder="https://acme.com" />
            <button onClick={autofill} disabled={inferring || !form.pricing_url} className="btn-ghost shrink-0 px-2.5" title="Auto-fill">
              <Icon name="sparkle" className={`h-4 w-4 ${inferring ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="analysis-product-details" className="label">Details</label>
          <textarea id="analysis-product-details" className="input min-h-[4.5rem] resize-y text-sm" value={form.description} onChange={set('description')}
            placeholder="What you do and who it’s for." />
        </div>
        <div className="flex justify-end gap-2">
          {product && <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>}
          <button onClick={save} disabled={saving} className="btn-primary px-3 py-1.5 text-xs">
            {saving ? <Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> : <Icon name="check" className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
    </Panel>
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
  const [candidates, setCandidates] = useState(null);
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
      if (candidates === null) setCandidates([]);
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
    toast({ type: 'success', title: 'Added, confirm below' });
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
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <input className="input" placeholder="Name *" value={manual.name}
        onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} autoFocus />
      <input className="input" placeholder="URL *" value={manual.pricing_url}
        onChange={(e) => setManual((m) => ({ ...m, pricing_url: e.target.value }))} />
      <div className="flex justify-end gap-2">
        <button onClick={() => { setShowManual(false); setManual({ name: '', pricing_url: '', notes: '' }); }} className="btn-ghost px-2.5 py-1 text-[11px]">Cancel</button>
        <button onClick={addManual} className="btn-primary px-2.5 py-1 text-[11px]"><Icon name="plus" className="h-3 w-3" /> Add</button>
      </div>
    </div>
  );

  if (candidates !== null) {
    return (
      <Panel title="Confirm competitors">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button onClick={discover} disabled={discovering} className="btn-ghost px-2.5 py-1 text-[11px]">
            <Icon name="search" className={`h-3 w-3 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Searching…' : 'Find more'}
          </button>
          {!showManual && (
            <button onClick={() => setShowManual(true)} className="btn-ghost px-2.5 py-1 text-[11px]">
              <Icon name="plus" className="h-3 w-3" /> Manual
            </button>
          )}
        </div>
        {showManual && <div className="mb-2">{manualForm}</div>}
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
          {candidates.length === 0 && !discovering && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-slate-500">
              No candidates yet.
            </p>
          )}
          {discovering && candidates.length === 0 && (
            <div className="space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          )}
          {candidates.map((c) => {
            const on = !!selected[c.pricing_url];
            return (
              <label key={c.pricing_url}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition ${
                  on ? 'border-accent/50 bg-accent/5' : 'border-white/10 bg-white/[0.02] opacity-80 hover:opacity-100'
                }`}>
                <input type="checkbox" checked={on}
                  onChange={(e) => setSelected((s) => ({ ...s, [c.pricing_url]: e.target.checked }))}
                  className="mt-0.5 h-3.5 w-3.5 accent-indigo-500" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-white">{c.name}</span>
                  <p className="truncate text-[10px] text-slate-500">{c.pricing_url}</p>
                </div>
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={() => { setCandidates(null); setSelected({}); }} className="btn-ghost px-2.5 py-1 text-[11px]">Cancel</button>
          <button onClick={confirm} disabled={saving || candidates.length === 0} className="btn-primary px-2.5 py-1 text-[11px]">
            {saving ? <Icon name="refresh" className="h-3 w-3 animate-spin" /> : <Icon name="check" className="h-3 w-3" />}
            Confirm
          </button>
        </div>
      </Panel>
    );
  }

  if (competitors.length === 0) {
    return (
      <Panel title="Competitors">
        <p className="text-xs text-slate-400">
          Find closest rivals to <strong className="text-slate-200">{product.name}</strong>, or add ones you know.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={discover} disabled={discovering} className="btn-primary px-3 py-1.5 text-xs">
            <Icon name="search" className={`h-3.5 w-3.5 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Searching…' : 'Find competitors'}
          </button>
          <button onClick={() => { setCandidates([]); setShowManual(true); }} className="btn-ghost px-3 py-1.5 text-xs">
            <Icon name="plus" className="h-3.5 w-3.5" /> Manual
          </button>
        </div>
        {discovering && (
          <div className="mt-3 space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="Competitors" done count={competitors.length}>
      <div className="flex flex-wrap gap-1.5">
        {competitors.map((c) => (
          <span key={c.id} className="group inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] py-1 pl-2 pr-1 text-xs text-slate-200">
            {c.name}
            {c.value_score != null && <span className="text-[10px] text-slate-500">{c.value_score}</span>}
            <button onClick={() => removeOne(c.id)} className="rounded p-0.5 text-slate-600 transition hover:bg-white/10 hover:text-rose-400">
              <Icon name="x" className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button onClick={discover} disabled={discovering} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/15 px-2 py-1 text-[11px] text-slate-500 transition hover:border-white/30 hover:text-slate-300">
          <Icon name={discovering ? 'refresh' : 'search'} className={`h-3 w-3 ${discovering ? 'animate-spin' : ''}`} /> Find more
        </button>
        <button onClick={() => { setCandidates([]); setShowManual(true); }} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/15 px-2 py-1 text-[11px] text-slate-500 transition hover:border-white/30 hover:text-slate-300">
          <Icon name="plus" className="h-3 w-3" /> Add
        </button>
      </div>
      {showManual && <div className="mt-2">{manualForm}</div>}
    </Panel>
  );
}

const LAYER_KEYS = ['icp', 'charts', 'pricing', 'features', 'value', 'reviews', 'strategy', 'take'];

function markLayers(setLayers, ids, status) {
  setLayers((prev) => {
    const next = { ...prev };
    for (const id of ids) next[id] = status;
    return next;
  });
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
  const [layers, setLayers] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [restoredAt, setRestoredAt] = useState(null);
  const [autoSave, setAutoSave] = useState(() => {
    try {
      const v = localStorage.getItem('cia_report_autosave');
      if (v === null) return true;
      return v !== '0' && v !== 'false';
    } catch {
      return true;
    }
  });
  /** Live score/analysis patches so Business value cards update before list reload. */
  const [scoreOverrides, setScoreOverrides] = useState({});
  const toast = useToast();
  const runIdRef = useRef(0);
  const snapshotRef = useRef({});
  const autoSaveRef = useRef(autoSave);

  useEffect(() => {
    autoSaveRef.current = autoSave;
    try {
      localStorage.setItem('cia_report_autosave', autoSave ? '1' : '0');
    } catch { /* ignore */ }
  }, [autoSave]);

  const scoredCompetitors = competitors.map((c) => {
    const patch = scoreOverrides[c.id];
    return patch ? { ...c, ...patch } : c;
  });

  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const jobKey = () => `cia_market_job_${getWorkspace()?.id || 'x'}`;

  useEffect(() => {
    snapshotRef.current = { matrix, positioning, reviews, take, market, product, strategy };
  }, [matrix, positioning, reviews, take, market, product, strategy]);

  const buildSnapshot = (extra = {}) => ({
    competitors: scoredCompetitors.map((c) => ({
      id: c.id,
      name: c.name,
      value_score: c.value_score ?? null,
      value_analysis: c.value_analysis ?? null,
      pricing_url: c.pricing_url ?? null,
    })),
    ...snapshotRef.current,
    ...extra,
    generatedAt: new Date().toISOString(),
  });

  const persistLatest = async (extra = {}, { force = false } = {}) => {
    if (!force && !autoSaveRef.current) return null;
    const snapshot = buildSnapshot(extra);
    const hasData = Boolean(
      snapshot.matrix || snapshot.positioning || snapshot.take || snapshot.strategy || snapshot.product
      || (Array.isArray(snapshot.reviews) && snapshot.reviews.length)
      || snapshot.market
    );
    if (!hasData) return null;
    try {
      setSaving(true);
      const { result } = await api.saveAnalysisLatest(snapshot);
      setRestoredAt(result?.savedAt || snapshot.generatedAt);
      return result;
    } catch (err) {
      console.error('[analysis] persist failed:', err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  /** Persist latest + a Reports history entry (used after regenerate when Auto save is on). */
  const autoSaveReport = async (extra = {}) => {
    if (!autoSaveRef.current) return null;
    const snapshot = buildSnapshot(extra);
    const hasData = Boolean(
      snapshot.matrix || snapshot.positioning || snapshot.take || snapshot.strategy || snapshot.product
      || (Array.isArray(snapshot.reviews) && snapshot.reviews.length)
      || snapshot.market
    );
    if (!hasData) return null;
    try {
      setSaving(true);
      const title = `Report · ${competitors.length} competitors · ${new Date().toLocaleDateString()}`;
      await api.saveReport(title, snapshot);
      const { result } = await api.saveAnalysisLatest(snapshot);
      setRestoredAt(result?.savedAt || snapshot.generatedAt);
      return result;
    } catch (err) {
      console.error('[analysis] auto-save failed:', err.message);
      toast({ type: 'error', title: 'Auto save failed', message: err.message });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoSave = async () => {
    const next = !autoSave;
    setAutoSave(next);
    autoSaveRef.current = next;
    if (next && !running) {
      const result = await persistLatest({}, { force: true });
      if (result) {
        toast({ type: 'success', title: 'Auto save on', message: 'Current report saved.' });
      } else {
        toast({ type: 'info', title: 'Auto save on', message: 'New regenerates and changes will save automatically.' });
      }
    } else if (!next) {
      toast({ type: 'info', title: 'Auto save off', message: 'Regenerates will not be saved until you turn it back on.' });
    }
  };

  const hydrateFromSnapshot = (result) => {
    if (!result || typeof result !== 'object') return false;
    if (result.matrix) setMatrix(result.matrix);
    if (result.positioning) setPositioning(result.positioning);
    if (result.reviews) setReviews(result.reviews);
    if (result.take) setTake(result.take);
    if (result.strategy) setStrategy(result.strategy);
    if (result.product) setProduct(result.product);
    if (result.market) setMarket(result.market);
    let hydratedScores = false;
    if (Array.isArray(result.competitors)) {
      const patches = {};
      for (const c of result.competitors) {
        if (c?.id != null && (c.value_score != null || c.value_analysis)) {
          patches[c.id] = {
            value_score: c.value_score ?? null,
            value_analysis: c.value_analysis ?? null,
          };
        }
      }
      if (Object.keys(patches).length) {
        hydratedScores = true;
        setScoreOverrides((prev) => ({ ...prev, ...patches }));
      }
    }

    const done = [];
    if (result.product || result.strategy?.icp || result.strategy?.business_model) done.push('icp');
    if (result.matrix) done.push('pricing', 'features', 'charts');
    if (result.positioning || competitors.some((c) => c.value_score != null) || hydratedScores) done.push('value');
    if (result.strategy) done.push('strategy');
    if (Array.isArray(result.reviews) && result.reviews.length) done.push('reviews');
    if (result.take) done.push('take');
    if (result.market) done.push('market');
    if (done.length) markLayers(setLayers, done, 'done');
    setRestoredAt(result.savedAt || result.generatedAt || null);
    return done.length > 0
      || Boolean(result.matrix || result.positioning || result.take || result.strategy || result.product || result.market);
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
    setMarketLoading(false);
    try { localStorage.removeItem(jobKey()); } catch { /* ignore */ }
  };

  const beginPolling = (jobId, startedAt) => {
    try { localStorage.setItem(jobKey(), JSON.stringify({ jobId, startedAt })); } catch { /* ignore */ }
    setMarketLoading(true);
    markLayers(setLayers, ['market'], 'loading');
    setMarketElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tickRef.current = setInterval(() => setMarketElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    const check = async () => {
      try {
        const { status, result, error } = await api.marketStatus(jobId);
        if (status === 'done') {
          stopPolling();
          if (result?.market) {
            setMarket(result.market);
            markLayers(setLayers, ['market'], 'done');
            // Merge market into the persisted latest analysis.
            snapshotRef.current = { ...snapshotRef.current, market: result.market };
            persistLatest({ market: result.market });
            toast({ type: 'success', title: 'Market intelligence ready' });
          } else {
            markLayers(setLayers, ['market'], 'idle');
            toast({ type: 'info', title: 'No market data found' });
          }
        } else if (status === 'error') {
          stopPolling();
          markLayers(setLayers, ['market'], 'error');
          toast({ type: 'error', title: 'Market research failed', message: error });
        }
      } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') {
          stopPolling();
          markLayers(setLayers, ['market'], 'error');
          toast({ type: 'error', title: 'Market job expired', message: 'Please run it again.' });
        }
      }
    };
    pollRef.current = setInterval(check, 5000);
    check();
  };

  const loadMarket = async () => {
    try {
      const { jobId } = await api.marketStart();
      beginPolling(jobId, Date.now());
    } catch (err) {
      toast({ type: 'error', title: 'Could not start research', message: err.message });
    }
  };

  // Restore last full analysis for this workspace on visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { result } = await api.getAnalysisLatest();
        if (!cancelled && result) hydrateFromSnapshot(result);
      } catch {
        /* ignore, empty canvas is fine */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let raw;
    try { raw = localStorage.getItem(jobKey()); } catch { /* ignore */ }
    if (raw) {
      try {
        const { jobId, startedAt } = JSON.parse(raw);
        if (jobId) beginPolling(jobId, startedAt || Date.now());
      } catch { /* ignore */ }
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Progressive layered analysis:
   * - Fire independent layers in parallel waves
   * - Paint each result as soon as it lands (tabs stay usable)
   * - Score / review competitors one-by-one so the first hits land in ~seconds
   * - Auto-persist when complete so the next visit restores the report
   */
  const runAll = async () => {
    const runId = ++runIdRef.current;
    const alive = () => runIdRef.current === runId;

    setRunning(true);
    setRestoredAt(null);
    setMatrix(null);
    setPositioning(null);
    setReviews([]);
    setTake(null);
    setMarket(null);
    setProduct(null);
    setStrategy(null);
    setScoreOverrides({});
    snapshotRef.current = {};
    markLayers(setLayers, LAYER_KEYS, 'loading');
    setProgress('Starting layered research…');

    // Accumulate locally so persist doesn't race React state.
    const collected = {
      matrix: null,
      positioning: null,
      reviews: [],
      take: null,
      market: null,
      product: null,
      strategy: null,
    };

    try {
      // Wave 0, refresh EVERY rival page. Thin/blocked scrapes used to set
      // hasSnapshot=true and skip research, leaving Pricing/Features empty.
      if (competitors.length) {
        setProgress(`Layer 0 · fetching ${competitors.length} competitor page${competitors.length === 1 ? '' : 's'}…`);
        await Promise.all(
          competitors.map((c) => api.refreshOne(c.id).catch(() => null))
        );
        if (!alive()) return;
        onScored?.();
      }

      // Wave 1, fast parallel foundations (ICP + pricing/features + first value scores)
      setProgress('Layer 1 · product, pricing matrix, value scores…');
      const wave1 = [
        api.productAnalysis()
          .then((pr) => {
            if (!alive()) return;
            if (pr?.product) {
              collected.product = pr.product;
              setProduct(pr.product);
            }
            markLayers(setLayers, ['icp'], 'done');
          })
          .catch(() => { if (alive()) markLayers(setLayers, ['icp'], 'error'); }),

        api.featureMatrix(ids, true)
          .then((m) => {
            if (!alive()) return;
            collected.matrix = m;
            setMatrix(m);
            markLayers(setLayers, ['pricing', 'features', 'charts'], 'done');
          })
          .catch(() => {
            if (alive()) markLayers(setLayers, ['pricing', 'features', 'charts'], 'error');
          }),

        // Score competitors one-by-one so Business value cards fill as each finishes
        (async () => {
          // Always (re)score rivals that still lack a score on the list.
          const unscored = competitors.filter((c) => c.value_score == null);
          for (const c of unscored) {
            if (!alive()) return;
            setProgress(`Layer 1 · scoring ${c.name}…`);
            try {
              const r = await api.valueScore(c.id);
              if (!alive()) return;
              if (r?.score != null) {
                setScoreOverrides((prev) => ({
                  ...prev,
                  [c.id]: {
                    value_score: r.score,
                    value_analysis: r.reasoning || r.value_analysis || null,
                  },
                }));
              }
            } catch {
              /* keep going, other rivals may still score */
            }
            if (!alive()) return;
            onScored?.();
          }
          if (alive()) markLayers(setLayers, ['value'], 'loading'); // positioning still coming
        })(),
      ];
      await Promise.all(wave1);
      if (!alive()) return;
      if (autoSaveRef.current) {
        snapshotRef.current = { ...collected };
        await persistLatest(collected);
      }

      // Wave 2, narrative layers in parallel (user can already browse Wave 1 tabs)
      setProgress('Layer 2 · value narrative, strategy, reviews…');
      const wave2 = [
        api.positioning()
          .then((p) => {
            if (!alive()) return;
            collected.positioning = p?.analysis || null;
            setPositioning(collected.positioning);
            markLayers(setLayers, ['value'], 'done');
          })
          .catch(() => { if (alive()) markLayers(setLayers, ['value'], 'done'); }),

        api.strategy()
          .then((s) => {
            if (!alive()) return;
            collected.strategy = s?.strategy || null;
            setStrategy(collected.strategy);
            markLayers(setLayers, ['strategy'], 'done');
            // Strategy may also fill ICP if product analysis was thin
            if (s?.strategy?.icp || s?.strategy?.business_model) {
              markLayers(setLayers, ['icp'], 'done');
            }
          })
          .catch(() => { if (alive()) markLayers(setLayers, ['strategy'], 'error'); }),

        // Reviews one competitor at a time, first review lands quickly
        (async () => {
          const rows = [];
          for (const c of competitors) {
            if (!alive()) return;
            setProgress(`Layer 2 · reviews for ${c.name}…`);
            try {
              const r = await api.reviews([c.id]);
              if (!alive()) return;
              const row = (r?.reviews || [])[0];
              if (row) {
                rows.push(row);
                collected.reviews = [...rows];
                setReviews([...rows]);
              }
            } catch {
              rows.push({ id: c.id, name: c.name, sentiment: null });
              collected.reviews = [...rows];
              if (alive()) setReviews([...rows]);
            }
          }
          if (alive()) markLayers(setLayers, ['reviews'], 'done');
        })(),
      ];
      await Promise.all(wave2);
      if (!alive()) return;
      if (autoSaveRef.current) {
        snapshotRef.current = { ...collected };
        await persistLatest(collected);
      }

      // Wave 3, analyst take (uses scores/snapshots already on the server)
      setProgress('Layer 3 · analyst take…');
      try {
        const t = await api.analystTake();
        if (!alive()) return;
        collected.take = t?.take || null;
        setTake(collected.take);
        markLayers(setLayers, ['take'], 'done');
      } catch {
        if (alive()) markLayers(setLayers, ['take'], 'error');
      }

      if (alive()) {
        snapshotRef.current = { ...collected };
        setProgress('');
        if (autoSaveRef.current) {
          await autoSaveReport(collected);
          toast({
            type: 'success',
            title: 'Report auto-saved',
            message: 'Restored next visit · also in Reports.',
          });
        } else {
          toast({
            type: 'success',
            title: 'Analysis complete',
            message: 'Auto save is off, turn it on to keep this report.',
          });
        }
      }
    } catch (err) {
      if (alive()) toast({ type: 'error', title: 'Analysis failed', message: err.message });
    } finally {
      if (alive()) {
        setRunning(false);
        setProgress('');
      }
    }
  };

  const hasReport = Boolean(
    matrix || positioning || (reviews && reviews.length) || take || strategy || product
    || scoredCompetitors.some((c) => c.value_score != null)
    || running
  );

  const exportMarkdown = async () => {
    setExporting(true);
    try {
      const snapshot = {
        competitors, matrix, positioning, reviews, take, market, product, strategy,
        generatedAt: new Date().toISOString(),
      };
      const { markdown } = await api.exportFeatureReport(snapshot, 'markdown');
      await navigator.clipboard?.writeText(markdown || '');
      toast({ type: 'success', title: 'Markdown copied' });
    } catch (err) {
      toast({ type: 'error', title: 'Export failed', message: err.message });
    } finally {
      setExporting(false);
    }
  };

  if (hydrating) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-10 w-full max-w-xl rounded-xl" />
        <Shimmer className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!hasReport) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="glass max-w-lg rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-accent/15 text-accent-soft">
            <Icon name="sparkle" className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-white">Run competitive report</h2>
          <p className="mt-2 text-sm text-slate-400">
            Research runs layer by layer. With Auto save on, the report is kept for your next visit and Reports history.
          </p>
          <button onClick={runAll} className="btn-primary mt-5">
            <Icon name="sparkle" className="h-4 w-4" /> Run full analysis
          </button>
        </div>
      </div>
    );
  }

  const doneCount = LAYER_KEYS.filter((k) => layers[k] === 'done').length;
  const loadingCount = LAYER_KEYS.filter((k) => layers[k] === 'loading').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5 sm:px-5">
        <button onClick={runAll} disabled={running || saving || exporting} className="btn-ghost h-auto px-2.5 py-1.5 text-xs">
          <Icon name="refresh" className="h-3.5 w-3.5" />
          {running ? 'Running…' : 'Regenerate'}
        </button>
        <button onClick={exportMarkdown} disabled={exporting || running} className="btn-ghost h-auto px-2.5 py-1.5 text-xs">
          {exporting
            ? <><Shimmer className="h-3.5 w-12 rounded-md" /> Exporting…</>
            : <><Icon name="download" className="h-3.5 w-3.5" /> Export</>}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={autoSave}
          aria-label="Auto save"
          onClick={toggleAutoSave}
          disabled={running}
          className="inline-flex h-auto items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-sm border transition ${
              autoSave
                ? 'border-accent/50 bg-accent/30'
                : 'border-white/15 bg-ink-900'
            }`}
          >
            <span
              className={`absolute h-2.5 w-2.5 rounded-sm bg-white transition ${
                autoSave ? 'left-[13px]' : 'left-0.5'
              }`}
            />
          </span>
          Auto save
          {saving ? <span className="text-slate-500">· saving…</span> : null}
        </button>

        {running && (
          <div className="flex min-w-0 max-w-[16rem] flex-col gap-1 sm:max-w-xs">
            <span className="truncate text-xs text-slate-400">
              {progress || `Layers ${doneCount}/${LAYER_KEYS.length}`}
            </span>
            <Shimmer className="h-1 w-full rounded-md" />
          </div>
        )}
        {!running && doneCount > 0 && (
          <span className="text-xs text-slate-500">
            {doneCount} layers ready
            {autoSave && restoredAt ? ` · saved ${new Date(restoredAt).toLocaleString()}` : ''}
            {!autoSave ? ' · auto save off' : ''}
          </span>
        )}
        {!market && !marketLoading && (
          <button onClick={loadMarket} disabled={running} className="btn-ghost ml-auto px-2.5 py-1.5 text-xs">
            <Icon name="trending" className="h-3.5 w-3.5" /> Market intel
          </button>
        )}
        {marketLoading && (
          <div className="ml-auto flex min-w-[7rem] flex-col gap-1">
            <span className="text-xs text-slate-400">
              Market {Math.floor(marketElapsed / 60)}:{String(marketElapsed % 60).padStart(2, '0')}
            </span>
            <Shimmer className="h-1 w-full rounded-full" />
          </div>
        )}
        {loadingCount > 0 && !marketLoading && !running && <span className="ml-auto sm:hidden" />}
      </div>

      <div className="min-h-0 flex-1">
        <ReportView
          layout="tabs"
          layers={layers}
          competitors={scoredCompetitors}
          matrix={matrix}
          positioning={positioning}
          reviews={reviews}
          take={take}
          market={market}
          product={product}
          strategy={strategy}
        />
      </div>
    </div>
  );
}

function Panel({ title, children, done, count }) {
  return (
    <section className="glass rounded-xl p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-emerald-600 text-white' : 'bg-accent text-white'
        }`}>
          {done ? <Icon name="check" className="h-3 w-3" /> : '·'}
        </span>
        <h2 className="text-xs font-semibold text-white">{title}</h2>
        {count != null && <span className="text-[11px] text-slate-500">· {count}</span>}
      </div>
      {children}
    </section>
  );
}
