'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';

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
      title="Positioning lab"
      subtitle="Pressure-test three ways to explain why your product should win."
      action={<button onClick={generate} disabled={generating} className="btn-primary text-sm">
        <Icon name={generating ? 'refresh' : 'sparkle'} className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
        {generating ? 'Generating...' : 'Generate options'}
      </button>}
    >
      <LabPanel>
        <label htmlFor="positioning-focus" className="label">Focus (optional)</label>
        <input id="positioning-focus" className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Example: enterprise security buyers, PLG teams, AI-native category" />
      </LabPanel>

      {generating && (
        <LabPanel title="Generating options">
          <LabShimmerBlock rows={3} />
        </LabPanel>
      )}

      {!generating && loading ? (
        <LabPanel><LabShimmerBlock rows={3} /></LabPanel>
      ) : !generating && !result ? (
        <EmptyState icon="sparkle" title="No positioning run yet">Generate three distinct options with scores, risks, and messaging guidance.</EmptyState>
      ) : !generating && result ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(result.options || []).slice(0, 3).map((option, i) => (
              <LabPanel key={option.name || i} className="!p-4">
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
              </LabPanel>
            ))}
          </div>

          {result.recommendation && (
            <LabPanel title="Recommendation">
              <p className="text-sm leading-relaxed text-slate-300">{result.recommendation}</p>
            </LabPanel>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ListCard title="Do" items={result.messagingDo} />
            <ListCard title="Do not" items={result.messagingDont} />
          </div>
        </div>
      ) : null}
    </LabShell>
  );
}

function ListCard({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <LabPanel title={title}>
      <ul className="space-y-2 text-sm text-slate-400">
        {items.map((item, i) => <li key={i}>- {item}</li>)}
      </ul>
    </LabPanel>
  );
}
