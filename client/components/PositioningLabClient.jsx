'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

export default function PositioningLabClient() {
  const [result, setResult] = useState(null);
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPositioningLab();
        setResult(res.result || null);
      } catch (err) {
        toast({ type: 'error', title: 'Could not load positioning', message: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.generatePositioningLab({ focus: focus.trim() || undefined });
      setResult(res.result || null);
      toast({ type: 'success', title: 'Positioning options ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not generate positioning', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <LabShell
      title="Positioning Lab"
      subtitle="Pressure-test three ways to explain why your product should win."
      action={<button onClick={generate} disabled={generating} className="btn-primary text-sm">
        {generating ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}
        {generating ? 'Generating...' : 'Generate options'}
      </button>}
    >
      <section className="card p-5">
        <label className="label">Focus (optional)</label>
        <input className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Example: enterprise security buyers, PLG teams, AI-native category" />
      </section>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-56" /><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      ) : !result ? (
        <EmptyState icon="sparkle" title="No positioning run yet">Generate three distinct options with scores, risks, and messaging guidance.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(result.options || []).slice(0, 3).map((option, i) => (
              <section key={option.name || i} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">{option.name || `Option ${i + 1}`}</h2>
                  <span className="chip border-accent/30 bg-accent/10 text-accent-soft">{option.score || '-'} / 10</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{option.statement}</p>
                <p className="mt-3 text-xs text-slate-500">Audience</p>
                <p className="text-sm text-slate-400">{option.audience}</p>
                <p className="mt-3 text-xs text-slate-500">Differentiation</p>
                <p className="text-sm text-slate-400">{option.differentiation}</p>
                {option.why && <p className="mt-3 text-sm text-slate-500">{option.why}</p>}
              </section>
            ))}
          </div>

          {result.recommendation && (
            <section className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{result.recommendation}</p>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ListCard title="Do" items={result.messagingDo} />
            <ListCard title="Do not" items={result.messagingDont} />
          </div>
        </div>
      )}
    </LabShell>
  );
}

function ListCard({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-400">
        {items.map((item, i) => <li key={i}>- {item}</li>)}
      </ul>
    </section>
  );
}
