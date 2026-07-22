'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

const SEVERITY = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-ink-700 bg-ink-850 text-ink-soft',
};

export default function FeatureGapsClient() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getFeatureGaps();
        setResult(res.result || null);
      } catch (err) {
        toast({ type: 'error', title: 'Could not load feature gaps', message: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateFeatureGaps();
      setResult(res.result || null);
      toast({ type: 'success', title: 'Feature gaps ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not generate gaps', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <LabShell
      title="Feature gaps"
      subtitle="Spot missing capabilities and where competitors may be pulling ahead."
      action={<button onClick={generate} disabled={generating} className="btn-primary text-sm">
        {generating ? <Spinner /> : <Icon name="grid" className="h-4 w-4" />}
        {generating ? 'Scanning...' : 'Generate gaps'}
      </button>}
    >
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
      ) : !result ? (
        <EmptyState icon="grid" title="No feature gap scan yet">Generate a radar from competitor notes, positioning, and recent changes.</EmptyState>
      ) : (
        <div className="space-y-4">
          {result.summary && (
            <section className="card p-5">
              <p className="text-sm leading-relaxed text-ink-soft">{result.summary}</p>
            </section>
          )}
          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Who has it</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Effort</th>
                    <th className="px-4 py-3">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {(result.gaps || []).map((gap, i) => (
                    <tr key={`${gap.feature}-${i}`}>
                      <td className="px-4 py-3 font-medium text-ink">{gap.feature}</td>
                      <td className="px-4 py-3 text-ink-soft">{(gap.whoHasIt || []).join(', ') || '-'}</td>
                      <td className="px-4 py-3"><span className={`chip text-[10px] ${SEVERITY[gap.severity] || SEVERITY.low}`}>{gap.severity || 'low'}</span></td>
                      <td className="px-4 py-3 text-ink-soft">{gap.effort || '-'}</td>
                      <td className="px-4 py-3 text-ink-soft">{gap.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {result.quickWins?.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-ink">Quick wins</h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {result.quickWins.map((item, i) => <li key={i}>- {item}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </LabShell>
  );
}
