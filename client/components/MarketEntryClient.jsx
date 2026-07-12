'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

export default function MarketEntryClient() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ geography: '', segment: '' });
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getMarketEntry();
        setResult(res.result || null);
        if (res.result) {
          setForm({ geography: res.result.geography || '', segment: res.result.segment || '' });
        }
      } catch (err) {
        toast({ type: 'error', title: 'Could not load checklist', message: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateMarketEntry({
        geography: form.geography.trim() || undefined,
        segment: form.segment.trim() || undefined,
      });
      setResult(res.result || null);
      toast({ type: 'success', title: 'Market entry checklist ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not generate checklist', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <LabShell
      title="Market Entry"
      subtitle="Build a launch checklist for a new geography or customer segment."
      action={<button onClick={generate} disabled={generating} className="btn-primary text-sm">
        {generating ? <Spinner /> : <Icon name="map" className="h-4 w-4" />}
        {generating ? 'Building...' : 'Generate checklist'}
      </button>}
    >
      <section className="card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Geography</label>
            <input className="input" value={form.geography} onChange={set('geography')} placeholder="UK, Germany, APAC..." />
          </div>
          <div>
            <label className="label">Segment</label>
            <input className="input" value={form.segment} onChange={set('segment')} placeholder="Mid-market finance, devtools teams..." />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-64" /></div>
      ) : !result ? (
        <EmptyState icon="map" title="No market entry plan yet">Generate a focused checklist before spending go-to-market time.</EmptyState>
      ) : (
        <div className="space-y-4">
          {result.summary && (
            <section className="card p-5">
              <p className="text-sm leading-relaxed text-slate-300">{result.summary}</p>
              {result.samSomHint && <p className="mt-3 text-xs text-slate-500">{result.samSomHint}</p>}
            </section>
          )}

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Checklist</h2>
            <div className="mt-4 space-y-3">
              {(result.checklist || []).map((item, i) => (
                <div key={`${item.item}-${i}`} className="flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ink-600 text-slate-600">
                    {item.done ? <Icon name="check" className="h-3 w-3" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{item.item}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="chip border-accent/30 bg-accent/10 text-accent-soft">{item.priority || 'P1'}</span>
                      {item.owner && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.owner}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {result.risks?.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-white">Risks</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {result.risks.map((risk, i) => <li key={i}>- {risk}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </LabShell>
  );
}
