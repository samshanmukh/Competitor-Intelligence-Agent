'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';

const SEVERITY = {
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-ink-700 bg-ink-850 text-slate-400',
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
        <Icon name={generating ? 'refresh' : 'grid'} className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
        {generating ? 'Scanning...' : 'Generate gaps'}
      </button>}
    >
      {generating && (
        <LabPanel title="Scanning gaps">
          <LabShimmerBlock rows={3} />
        </LabPanel>
      )}

      {!generating && loading ? (
        <LabPanel><LabShimmerBlock rows={3} /></LabPanel>
      ) : !generating && !result ? (
        <EmptyState icon="grid" title="No feature gap scan yet">Generate a radar from competitor notes, positioning, and recent changes.</EmptyState>
      ) : !generating && result ? (
        <div className="space-y-4">
          {result.summary && (
            <LabPanel>
              <p className="text-sm leading-relaxed text-slate-300">{result.summary}</p>
            </LabPanel>
          )}
          <LabPanel className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-700 text-xs uppercase tracking-wide text-slate-500">
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
                      <td className="px-4 py-3 font-medium text-white">{gap.feature}</td>
                      <td className="px-4 py-3 text-slate-400">{(gap.whoHasIt || []).join(', ') || '-'}</td>
                      <td className="px-4 py-3"><span className={`chip text-[10px] ${SEVERITY[gap.severity] || SEVERITY.low}`}>{gap.severity || 'low'}</span></td>
                      <td className="px-4 py-3 text-slate-400">{gap.effort || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{gap.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LabPanel>
          {result.quickWins?.length > 0 && (
            <LabPanel title="Quick wins">
              <ul className="space-y-2 text-sm text-slate-400">
                {result.quickWins.map((item, i) => <li key={i}>- {item}</li>)}
              </ul>
            </LabPanel>
          )}
        </div>
      ) : null}
    </LabShell>
  );
}
