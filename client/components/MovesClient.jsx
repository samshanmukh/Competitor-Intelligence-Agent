'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

const IMPACT = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-ink-700 bg-ink-850 text-ink-soft',
};

export default function MovesClient() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.getNextMoves();
      setBrief(res.brief || null);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load moves', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateNextMoves();
      setBrief(res.brief || null);
      toast({ type: 'success', title: 'Next moves ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not generate moves', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const moves = [...(brief?.moves || [])].sort((a, b) => Number(a.priority || 9) - Number(b.priority || 9));

  return (
    <LabShell
      title="Next moves"
      subtitle="A short, founder-facing brief of what to do next from market and competitor signals."
      action={<button onClick={generate} disabled={generating} className="btn-primary text-sm">
        {generating ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}
        {generating ? 'Generating...' : 'Generate brief'}
      </button>}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !brief ? (
        <EmptyState icon="trending" title="No brief yet" action={<button onClick={generate} className="btn-primary">Generate next moves</button>}>
          Turn recent competitor changes into a prioritized operating plan.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <section className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Brief</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{brief.summary}</p>
          </section>

          <section className="space-y-2">
            {moves.map((move, i) => (
              <div key={`${move.title}-${i}`} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-semibold text-accent">
                    P{move.priority || i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-ink">{move.title}</h2>
                      <span className={`chip text-[10px] ${IMPACT[move.impact] || IMPACT.low}`}>{move.impact || 'low'} impact</span>
                      <span className="chip border-ink-700 bg-ink-850 text-[10px] text-ink-soft">{move.owner || 'founders'}</span>
                      <span className="chip border-ink-700 bg-ink-850 text-[10px] text-ink-soft">{move.effort || 'M'} effort</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{move.why}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {brief.watchouts?.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-ink">Watchouts</h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {brief.watchouts.map((w, i) => <li key={i}>- {w}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </LabShell>
  );
}
