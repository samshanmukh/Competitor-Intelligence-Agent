'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Skeleton, EmptyState, ValueScore, useToast } from './ui';
import Link from 'next/link';

export default function CompareClient() {
  const [competitors, setCompetitors] = useState(null);
  const [selected, setSelected] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.listCompetitors('approved')
      .then(({ competitors }) => setCompetitors(competitors || []))
      .catch((err) => toast({ type: 'error', title: 'Failed to load', message: err.message }));
  }, []);

  const toggle = (id) => {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s
    );
    setMatrix(null);
  };

  const compare = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    try {
      const result = await api.featureMatrix(selected);
      setMatrix(result);
    } catch (err) {
      toast({ type: 'error', title: 'Compare failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedCompetitors = (competitors || []).filter((c) => selected.includes(c.id));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Compare</h1>
        <p className="mt-1 text-sm text-slate-500">Select 2–4 competitors to generate an AI feature matrix</p>
      </div>

      {/* Competitor picker */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Select competitors</h2>
        {competitors === null ? (
          <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-36" />)}</div>
        ) : competitors.length === 0 ? (
          <p className="text-sm text-slate-500">No approved competitors. <Link href="/discover" className="text-accent-soft">Discover some first.</Link></p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {competitors.map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                  selected.includes(c.id)
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-ink-700 bg-ink-850 text-slate-400 hover:border-ink-600 hover:text-slate-200'
                }`}
              >
                {selected.includes(c.id) && <Icon name="check" className="h-3.5 w-3.5 text-accent-soft" />}
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-600">{selected.length}/4 selected</span>
          <button
            onClick={compare}
            disabled={selected.length < 2 || loading}
            className="btn-primary"
          >
            {loading ? (
              <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Icon name="sparkle" className="h-4 w-4" /> Generate matrix</>
            )}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      )}

      {/* Feature Matrix */}
      {matrix && !loading && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 min-w-48">Feature</th>
                {matrix.competitors?.map((comp) => (
                  <th key={comp.name} className="px-4 py-3 text-center min-w-32">
                    <div className="text-sm font-semibold text-white">{comp.name}</div>
                    {comp.tiers?.[0]?.price_monthly != null && (
                      <div className="text-xs text-slate-500 font-normal">from ${comp.tiers[0].price_monthly}/mo</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {matrix.features?.map((feature, fi) => (
                <tr key={fi} className="hover:bg-ink-850/30 transition">
                  <td className="px-4 py-3 text-slate-300 text-xs">{feature}</td>
                  {matrix.competitors?.map((comp) => {
                    const tier = comp.tiers?.[0];
                    const has = tier?.features?.[fi];
                    return (
                      <td key={comp.name} className="px-4 py-3 text-center">
                        {has === true ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-950/40 text-emerald-400">
                            <Icon name="check" className="h-3 w-3" />
                          </span>
                        ) : has === false ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-800 text-slate-600">
                            <Icon name="x" className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="text-slate-700 text-xs">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Value scores */}
      {selectedCompetitors.length >= 2 && !loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {selectedCompetitors.map((c) => (
            <div key={c.id} className="card p-4 text-center space-y-2">
              <div className="text-sm font-semibold text-white">{c.name}</div>
              <div className="text-2xl font-bold">
                <ValueScore score={c.value_score} />
              </div>
              {c.value_analysis && <p className="text-xs text-slate-500 line-clamp-3">{c.value_analysis}</p>}
              {c.value_score == null && (
                <Link href={`/competitors/${c.id}`} className="text-xs text-accent-soft">Run analysis →</Link>
              )}
            </div>
          ))}
        </div>
      )}

      {!matrix && selected.length < 2 && competitors?.length > 0 && (
        <EmptyState icon="bar" title="Select 2–4 competitors">
          Choose competitors above to generate a side-by-side feature and pricing comparison.
        </EmptyState>
      )}
    </div>
  );
}
