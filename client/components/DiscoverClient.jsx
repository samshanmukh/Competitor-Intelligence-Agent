'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Spinner, useToast } from './ui';

const MODES = [
  { id: 'describe', icon: 'sparkle', title: 'Describe your market', hint: 'Plain English — the agent finds competitors.' },
  { id: 'product', icon: 'external', title: 'Your product URL', hint: 'Agent reads your site and infers the market.' },
  { id: 'direct', icon: 'plus', title: 'Direct competitor URLs', hint: 'Skip discovery — monitor these pricing pages.' },
  { id: 'combo', icon: 'radar', title: 'Combination', hint: 'Product URL + known competitors + discover more.' },
];

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
  const toast = useToast();
  const router = useRouter();

  const parsedUrls = urlsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  const runDiscovery = async () => {
    setLoading(true);
    setCandidates(null);
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
      router.push('/');
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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Discover competitors</h1>
        <p className="mt-1 text-sm text-slate-400">
          Four ways to get started. Pick whichever fits — you can always add more later.
        </p>
      </header>

      {/* Mode selector */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setCandidates(null); }}
            className={`card flex flex-col items-start gap-2 p-4 text-left transition ${
              mode === m.id ? 'border-accent/60 ring-1 ring-accent/40' : 'hover:border-ink-600'
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              mode === m.id ? 'bg-accent/20 text-accent-soft' : 'bg-ink-800 text-slate-400'
            }`}>
              <Icon name={m.icon} className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-white">{m.title}</span>
            <span className="text-xs leading-snug text-slate-500">{m.hint}</span>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="card space-y-4 p-5">
        {(mode === 'describe' || mode === 'combo') && (
          <div>
            <label className="label">Market description</label>
            <textarea
              className="input min-h-[84px] resize-y"
              placeholder='"I build AI running coaching apps for amateur marathoners"'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}
        {(mode === 'product' || mode === 'combo') && (
          <div>
            <label className="label">Your product URL</label>
            <input
              className="input"
              placeholder="https://yourproduct.com"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-500">The agent reads this page to infer your market.</p>
          </div>
        )}
        {(mode === 'direct' || mode === 'combo') && (
          <div>
            <label className="label">Competitor pricing URLs</label>
            <textarea
              className="input min-h-[84px] resize-y font-mono text-xs"
              placeholder={'https://competitor-a.com/pricing\nhttps://competitor-b.com/plans'}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-500">One per line (or comma-separated). These skip discovery.</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-500">
            {mode === 'direct'
              ? 'Pages are added directly — no You.com Research call needed.'
              : 'Uses the You.com Research API + Grok to find and structure competitors.'}
          </p>
          <button onClick={runDiscovery} disabled={!canRun || loading} className="btn-primary">
            {loading ? <Spinner /> : <Icon name="search" />}
            {loading ? 'Discovering…' : mode === 'direct' ? 'Add pages' : 'Run discovery'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="card flex items-center gap-3 px-4 py-3 text-sm text-slate-300">
          <Spinner /> Searching the web and structuring results… this usually takes 10–30 seconds.
        </div>
      )}

      {/* Results / approval */}
      {candidates !== null && !loading && (
        candidates.length === 0 ? (
          <EmptyState icon="search" title="No competitors found">
            Try describing your market more specifically, or switch to "Direct competitor URLs" and
            paste pricing pages you already know.
          </EmptyState>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Review &amp; approve</h2>
                {market && (
                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    <span className="text-slate-500">Detected market:</span> {market}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  onClick={() => setSelected(Object.fromEntries(candidates.map((c) => [c.pricing_url, true])))}
                  className="hover:text-slate-300"
                >
                  Select all
                </button>
                <span>·</span>
                <button onClick={() => setSelected({})} className="hover:text-slate-300">Clear</button>
              </div>
            </div>

            <div className="space-y-2">
              {candidates.map((c) => {
                const on = !!selected[c.pricing_url];
                return (
                  <label
                    key={c.pricing_url}
                    className={`card flex cursor-pointer items-start gap-3 p-4 transition ${
                      on ? 'border-accent/50' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setSelected((s) => ({ ...s, [c.pricing_url]: e.target.checked }))}
                      className="mt-1 h-4 w-4 accent-indigo-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{c.name}</span>
                        {c.notes === 'Added directly' && (
                          <span className="chip border-ink-700 bg-ink-850 text-slate-400">direct</span>
                        )}
                      </div>
                      <a
                        href={c.pricing_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex items-center gap-1 text-xs text-accent-soft hover:underline"
                      >
                        {c.pricing_url} <Icon name="external" className="h-3 w-3" />
                      </a>
                      {c.notes && c.notes !== 'Added directly' && (
                        <p className="mt-1 text-xs text-slate-500">{c.notes}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {Object.values(selected).filter(Boolean).length} of {candidates.length} selected
              </span>
              <button onClick={saveSelected} disabled={saving} className="btn-primary">
                {saving ? <Spinner /> : <Icon name="check" />}
                {saving ? 'Saving…' : 'Approve & monitor'}
              </button>
            </div>
          </section>
        )
      )}
    </div>
  );
}
