'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '../lib/api';
import { CompanyLogo, EmptyState, Icon, Skeleton, useToast } from './ui';
import { PageHeader, PageShell } from './PageShell';

const MODES = [
  { id: 'describe', icon: 'sparkle', title: 'Describe market', hint: 'Plain English — AI finds competitors.' },
  { id: 'product', icon: 'external', title: 'Product URL', hint: 'AI reads your site, infers the market.' },
  { id: 'direct', icon: 'plus', title: 'Direct URLs', hint: 'Skip discovery — monitor these pages.' },
  { id: 'combo', icon: 'radar', title: 'Combination', hint: 'Product URL + known + discover more.' },
];

const STEPS = ['Search', 'Review', 'Done'];

export default function DiscoverClient() {
  const [mode, setMode] = useState('describe');
  const [description, setDescription] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const toast = useToast();

  const step = completedCount > 0 ? 2 : candidates === null ? 0 : 1;
  const parsedUrls = urlsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  const runDiscovery = async () => {
    setLoading(true);
    setCandidates(null);
    setCompletedCount(0);
    try {
      const payload = {
        mode,
        description: ['product', 'direct'].includes(mode) ? '' : description,
        productUrl: ['product', 'combo'].includes(mode) ? productUrl : '',
        competitorUrls: ['direct', 'combo'].includes(mode) ? parsedUrls : [],
      };
      const { market, candidates } = await api.discover(payload);
      setMarket(market);
      setCandidates(candidates);
      setSelected(Object.fromEntries(candidates.map((c) => [c.pricing_url, true])));
      if (!candidates.length) {
        toast({ type: 'info', title: 'No competitors found', message: 'Try a more specific description or add URLs directly.' });
      }
    } catch (err) {
      toast({ type: 'error', title: 'Discovery failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const saveSelected = async () => {
    const chosen = candidates.filter((c) => selected[c.pricing_url]);
    if (!chosen.length) {
      toast({ type: 'info', title: 'Nothing selected', message: 'Approve at least one competitor.' });
      return;
    }
    setSaving(true);
    try {
      await api.addCompetitors(chosen, 'approved');
      if (market) await api.saveSettings({ market });
      toast({ type: 'success', title: `${chosen.length} competitor(s) added`, message: 'Monitoring has begun.' });
      setCompletedCount(chosen.length);
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const canRun =
    (mode === 'describe' && description.trim()) ||
    (mode === 'product' && productUrl.trim()) ||
    (mode === 'direct' && parsedUrls.length) ||
    (mode === 'combo' && (productUrl.trim() || parsedUrls.length || description.trim()));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <PageShell>
      <PageHeader
        title="Discover"
        description="Find competitors automatically, then approve them for monitoring."
      />

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
              i < step ? 'bg-emerald-600 text-white' :
              i === step ? 'bg-accent text-white' :
              'bg-ink-800 text-ink-faint'
            }`}>
              {i < step ? <Icon name="check" className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-ink' : 'text-ink-faint'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-ink-700" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          {/* Mode selector */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setCandidates(null); setCompletedCount(0); }}
                className={`card flex flex-col items-start gap-2 p-4 text-left transition ${
                  mode === m.id ? 'border-accent/60 ring-1 ring-accent/40' : 'hover:border-ink-600'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  mode === m.id ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-ink-soft'
                }`}>
                  <Icon name={m.icon} className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-ink">{m.title}</span>
                <span className="text-xs leading-snug text-ink-soft">{m.hint}</span>
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div className="card space-y-4 p-5">
            {(mode === 'describe' || mode === 'combo') && (
              <div>
                <label htmlFor="discover-market-description" className="label">Market description</label>
                <textarea
                  id="discover-market-description"
                  className="input min-h-[84px] resize-y"
                  placeholder='"AI running coaching apps for amateur marathoners"'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}
            {(mode === 'product' || mode === 'combo') && (
              <div>
                <label htmlFor="discover-product-url" className="label">Your product URL</label>
                <input id="discover-product-url" className="input" placeholder="https://yourproduct.com" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
                <p className="mt-1.5 text-xs text-ink-soft">The agent reads this page to infer your market.</p>
              </div>
            )}
            {(mode === 'direct' || mode === 'combo') && (
              <div>
                <label htmlFor="discover-competitor-urls" className="label">Competitor pricing URLs</label>
                <textarea
                  id="discover-competitor-urls"
                  className="input min-h-[84px] resize-y font-mono text-xs"
                  placeholder={'https://competitor-a.com/pricing\nhttps://competitor-b.com/plans'}
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-ink-soft">One per line. These skip discovery.</p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-ink-soft">
                {mode === 'direct' ? 'Pages added directly — no Research call.' : 'Uses You.com Research + Grok.'}
              </p>
              <button onClick={runDiscovery} disabled={!canRun || loading} className="btn-primary">
                <Icon name="search" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Discovering…' : mode === 'direct' ? 'Add pages' : 'Run discovery'}
              </button>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          )}
        </>
      )}

      {/* Review step */}
      {step === 1 && !loading && (
        candidates.length === 0 ? (
          <EmptyState icon="search" title="No competitors found" action={
            <button onClick={() => setCandidates(null)} className="btn-ghost">Try again</button>
          }>
            Try describing your market more specifically, or switch to "Direct URLs".
          </EmptyState>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Review &amp; approve</h2>
                {market && <p className="mt-1 max-w-2xl text-sm text-ink-soft"><span className="text-ink-soft">Market:</span> {market}</p>}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <button onClick={() => setSelected(Object.fromEntries(candidates.map((c) => [c.pricing_url, true])))} className="hover:text-ink-soft">Select all</button>
                <span>·</span>
                <button onClick={() => setSelected({})} className="hover:text-ink-soft">Clear</button>
              </div>
            </div>

            <div className="space-y-2">
              {candidates.map((c) => {
                const on = !!selected[c.pricing_url];
                return (
                  <label key={c.pricing_url}
                    className={`card flex cursor-pointer items-start gap-3 p-4 transition ${on ? 'border-accent/50' : 'opacity-70 hover:opacity-100'}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setSelected((s) => ({ ...s, [c.pricing_url]: e.target.checked }))}
                      className="mt-1 h-4 w-4 accent-[#5C6B52]"
                    />
                    <CompanyLogo name={c.name} website={c.website} pricing_url={c.pricing_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{c.name}</span>
                        {c.notes === 'Added directly' && <span className="chip border-ink-700 bg-ink-850 text-ink-soft text-[10px]">direct</span>}
                      </div>
                      <a href={c.pricing_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex items-center gap-1 text-xs text-accent hover:underline truncate">
                        {c.pricing_url} <Icon name="external" className="h-3 w-3 shrink-0" />
                      </a>
                      {c.notes && c.notes !== 'Added directly' && <p className="mt-1 text-xs text-ink-soft">{c.notes}</p>}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setCandidates(null)} className="btn-ghost text-sm">
                <Icon name="chevronLeft" className="h-4 w-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-soft">{selectedCount} of {candidates.length} selected</span>
                <button onClick={saveSelected} disabled={saving || selectedCount === 0} className="btn-primary">
                  <Icon name="check" className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
                  {saving ? 'Saving…' : 'Approve & monitor'}
                </button>
              </div>
            </div>
          </section>
        )
      )}

      {step === 2 && (
        <section className="card flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">Competitors added</h2>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            {completedCount} competitor{completedCount === 1 ? '' : 's'} added. Monitoring is now underway.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => { setCandidates(null); setCompletedCount(0); }}
              className="btn-ghost"
            >
              Add more
            </button>
            <Link href="/competitors" className="btn-primary">View competitors</Link>
          </div>
        </section>
      )}
    </PageShell>
  );
}
