'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { EmptyState, Icon, ImpactBadge, Skeleton, timeAgo, useToast } from './ui';

function ChangeCard({ change }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = typeof change.analysis === 'string' ? (() => { try { return JSON.parse(change.analysis); } catch { return null; } })() : change.analysis;

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-ink-850/30 transition"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          analysis?.impact === 'high' ? 'border-rose-800/40 bg-rose-950/30 text-rose-400' :
          analysis?.impact === 'medium' ? 'border-amber-800/40 bg-amber-950/30 text-amber-400' :
          'border-ink-700 bg-ink-800 text-slate-500'
        }`}>
          <Icon name="activity" className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {change.competitor_name && (
              <span className="text-sm font-semibold text-white">{change.competitor_name}</span>
            )}
            <ImpactBadge impact={analysis?.impact} />
            <span className="ml-auto text-xs text-slate-600 shrink-0">{timeAgo(change.detected_at)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {analysis?.summary || change.summary || 'Pricing page updated'}
          </p>
          {analysis?.tags?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {analysis.tags.map((tag) => (
                <span key={tag} className="chip border-ink-700 bg-ink-850 text-slate-500 text-[10px]">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <Icon
          name={expanded ? 'chevronUp' : 'chevronDown'}
          className="h-4 w-4 shrink-0 text-slate-600 mt-0.5"
        />
      </div>

      {expanded && (
        <div className="border-t border-ink-700 bg-ink-950/40">
          {change.diff && (
            <div className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Diff</h3>
              <pre className="overflow-x-auto rounded-lg bg-ink-950 p-3 text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap">
                {change.diff.slice(0, 3000)}{change.diff.length > 3000 ? '\n…(truncated)' : ''}
              </pre>
            </div>
          )}
          {analysis?.details && (
            <div className="px-4 pb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">AI Analysis</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{analysis.details}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChangesClient() {
  const [changes, setChanges] = useState(null);
  const [filter, setFilter] = useState('all');
  const [unseen, setUnseen] = useState(0);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const { changes, unseen } = await api.changes(100);
        setChanges(changes.map((c) => {
          try { return { ...c, analysis: typeof c.analysis === 'string' ? JSON.parse(c.analysis) : c.analysis }; }
          catch { return c; }
        }));
        setUnseen(unseen);
        await api.markSeen();
      } catch (err) {
        toast({ type: 'error', title: 'Failed to load', message: err.message });
      }
    })();
  }, []);

  const filtered = (changes || []).filter((c) => {
    if (filter === 'all') return true;
    return c.analysis?.impact === filter;
  });

  const loading = changes === null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Changes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? '…' : `${filtered.length} change${filtered.length !== 1 ? 's' : ''}${unseen > 0 ? ` · ${unseen} new` : ''}`}
          </p>
        </div>
        <div className="flex rounded-lg border border-ink-700 bg-ink-900 p-0.5">
          {['all', 'high', 'medium', 'low'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                filter === f ? 'bg-ink-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="bell" title={filter === 'all' ? 'No changes detected' : `No ${filter}-impact changes`}>
          {filter === 'all'
            ? 'Run a refresh to check your tracked competitors for pricing changes.'
            : 'Try a different filter to see more changes.'}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => <ChangeCard key={c.id} change={c} />)}
        </div>
      )}
    </div>
  );
}
