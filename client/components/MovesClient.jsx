'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';

const IMPACT = {
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-ink-700 bg-ink-850 text-slate-400',
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
        <Icon name={generating ? 'refresh' : 'sparkle'} className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
        {generating ? 'Generating...' : 'Generate brief'}
      </button>}
    >
      {generating && (
        <LabPanel title="Generating brief">
          <LabShimmerBlock rows={3} />
        </LabPanel>
      )}

      {!generating && loading ? (
        <LabPanel><LabShimmerBlock rows={3} /></LabPanel>
      ) : !generating && !brief ? (
        <EmptyState icon="trending" title="No brief yet" action={<button onClick={generate} className="btn-primary">Generate next moves</button>}>
          Turn recent competitor changes into a prioritized operating plan.
        </EmptyState>
      ) : !generating && brief ? (
        <div className="space-y-4">
          <LabPanel title="Brief">
            <p className="text-sm leading-relaxed text-slate-300">{brief.summary}</p>
          </LabPanel>

          <section className="space-y-2">
            {moves.map((move, i) => (
              <LabPanel key={`${move.title}-${i}`} className="!p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-semibold text-accent-soft">
                    P{move.priority || i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">{move.title}</h2>
                      <span className={`chip text-[10px] ${IMPACT[move.impact] || IMPACT.low}`}>{move.impact || 'low'} impact</span>
                      <span className="chip border-ink-700 bg-ink-850 text-[10px] text-slate-400">{move.owner || 'founders'}</span>
                      <span className="chip border-ink-700 bg-ink-850 text-[10px] text-slate-400">{move.effort || 'M'} effort</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{move.why}</p>
                  </div>
                </div>
              </LabPanel>
            ))}
          </section>

          {brief.watchouts?.length > 0 && (
            <LabPanel title="Watchouts">
              <ul className="space-y-2 text-sm text-slate-400">
                {brief.watchouts.map((w, i) => <li key={i}>- {w}</li>)}
              </ul>
            </LabPanel>
          )}
        </div>
      ) : null}
    </LabShell>
  );
}
