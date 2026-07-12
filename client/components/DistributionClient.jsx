'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Skeleton, Spinner, useToast } from './ui';
import {
  DistributionEmptyState,
  DistributionPanel,
  METHOD_HINT,
} from './distribution/DistributionShared';
import { useMarketResearch } from '../hooks/useMarketResearch';

export default function DistributionClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [competitorCount, setCompetitorCount] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [pulse, { competitors }] = await Promise.all([
        api.marketPulse(),
        api.listCompetitors('approved').catch(() => ({ competitors: [] })),
      ]);
      setData(pulse);
      setCompetitorCount(competitors?.length ?? 0);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load distribution', message: err.message });
    }
  }, [toast]);

  const { researching, elapsed, phase, runResearch } = useMarketResearch({
    onComplete: load,
  });

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const distribution = data?.distribution;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Market distribution</h1>
          <p className="mt-1 text-sm text-slate-500">
            Published analyst share and triangulated presence across your tracked competitors.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/market" className="btn-ghost text-sm">Market model</Link>
          <button
            type="button"
            onClick={runResearch}
            disabled={researching || competitorCount === 0}
            className="btn-primary text-sm"
          >
            <Icon name={researching ? 'refresh' : 'trending'} className={`h-4 w-4 ${researching ? 'animate-spin' : ''}`} />
            {researching ? 'Researching…' : 'Refresh distribution'}
          </button>
        </div>
      </header>

      {researching && (
        <div className="card flex flex-col gap-1 p-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3">
            <Spinner />
            <span>{phase || 'Researching market distribution…'}</span>
          </div>
          <span className="tabular-nums sm:ml-auto">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
        </div>
      )}

      {!distribution?.items?.length && !researching && (
        <DistributionEmptyState
          competitorCount={competitorCount}
          onRunResearch={runResearch}
          researching={researching}
        />
      )}

      {distribution?.items?.length > 0 && (
        <>
          <DistributionPanel
            pulseData={data}
            showRefresh={false}
            showSyndicated
            showExport
            showPricingChanges
          />
          <p className="text-center text-xs text-slate-600">
            <Link href="/methodology" className="text-slate-400 hover:text-accent-soft">How we calculate presence</Link>
            {' · '}
            <Link href="/app" className="text-slate-400 hover:text-accent-soft">Full analysis report</Link>
          </p>
        </>
      )}

      {distribution?.items?.length > 0 && !data?.syndicated?.table?.rows?.length && (
        <p className="text-center text-[11px] text-slate-600">
          {METHOD_HINT[distribution.method]}
        </p>
      )}
    </div>
  );
}
