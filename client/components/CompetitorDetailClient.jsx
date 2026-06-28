'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  EmptyState, Icon, ImpactBadge, Spinner, timeAgo, useToast,
} from './ui';
import { ChangeTags } from './DashboardClient';

export default function CompetitorDetailClient({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('snapshot');
  const toast = useToast();
  const router = useRouter();

  const load = async () => {
    try {
      setData(await api.getCompetitor(id));
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { result } = await api.refreshOne(id);
      const map = {
        changed: { type: 'success', title: 'Change detected', message: result.summary },
        unchanged: { type: 'info', title: 'No change', message: 'Identical to last snapshot.' },
        first_snapshot: { type: 'success', title: 'Baseline captured' },
        error: { type: 'error', title: 'Fetch failed', message: result.error },
      };
      toast(map[result.status] || { title: 'Done' });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Refresh failed', message: err.message });
    } finally {
      setRefreshing(false);
    }
  };

  const remove = async () => {
    if (!confirm('Stop monitoring and delete this competitor and all its history?')) return;
    try {
      await api.deleteCompetitor(id);
      toast({ type: 'success', title: 'Removed' });
      router.push('/');
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove', message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Spinner /> <span className="ml-2 text-sm">Loading…</span>
      </div>
    );
  }
  if (!data) return null;

  const { competitor, latestSnapshot, changes } = data;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <Icon name="chevronLeft" className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{competitor.name}</h1>
          <a
            href={competitor.pricing_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-accent-soft hover:underline"
          >
            {competitor.pricing_url} <Icon name="external" className="h-3.5 w-3.5" />
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3.5 w-3.5" /> Checked {timeAgo(competitor.last_checked_at)}
            </span>
            {competitor.last_changed_at && <span>Last change {timeAgo(competitor.last_changed_at)}</span>}
            <span>{changes.length} change{changes.length === 1 ? '' : 's'} on record</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn-primary">
            {refreshing ? <Spinner /> : <Icon name="refresh" />}
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={remove} className="btn-danger px-2.5">
            <Icon name="trash" />
          </button>
        </div>
      </header>

      {competitor.last_error && (
        <div className="card flex items-start gap-2 border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Last fetch failed</div>
            <div className="text-rose-400/80">{competitor.last_error}</div>
            <div className="mt-1 text-xs text-rose-400/60">
              Some sites block automated scrapers. Try again later or verify the URL.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-800">
        {[
          { id: 'snapshot', label: 'Current snapshot' },
          { id: 'timeline', label: `Change history (${changes.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-accent text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'snapshot' ? (
        latestSnapshot ? (
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Captured {timeAgo(latestSnapshot.fetched_at)}</div>
            <pre className="card max-h-[600px] overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-slate-300">
              {latestSnapshot.content}
            </pre>
          </div>
        ) : (
          <EmptyState
            icon="clock"
            title="No snapshot yet"
            action={
              <button onClick={refresh} className="btn-primary">
                <Icon name="refresh" /> Fetch now
              </button>
            }
          >
            Hit refresh to capture the first baseline snapshot via You.com.
          </EmptyState>
        )
      ) : (
        <Timeline changes={changes} />
      )}
    </div>
  );
}

function Timeline({ changes }) {
  if (!changes.length) {
    return (
      <EmptyState icon="bell" title="No changes recorded">
        The first refresh captures a baseline. From then on, every difference is diffed, analyzed
        by Grok, and listed here.
      </EmptyState>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-ink-800 pl-6">
      {changes.map((ch) => (
        <li key={ch.id} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-accent" />
          <ChangeCard change={ch} />
        </li>
      ))}
    </ol>
  );
}

function ChangeCard({ change }) {
  const [showDiff, setShowDiff] = useState(false);
  const a = change.analysis || {};
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {a.impact && <ImpactBadge impact={a.impact} />}
          <span className="text-xs text-slate-500">{timeAgo(change.detected_at)}</span>
        </div>
        <button onClick={() => setShowDiff((s) => !s)} className="text-xs text-accent-soft hover:underline">
          {showDiff ? 'Hide diff' : 'View raw diff'}
        </button>
      </div>

      <p className="mt-2 text-sm font-medium text-white">{a.summary || change.summary}</p>
      {a.details && <p className="mt-1 text-sm text-slate-400">{a.details}</p>}
      <ChangeTags analysis={a} />

      {showDiff && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-ink-800 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed">
          {change.diff.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400'
                  : line.startsWith('-') && !line.startsWith('---') ? 'text-rose-400'
                    : line.startsWith('@@') ? 'text-accent-soft'
                      : 'text-slate-500'
              }
            >
              {line || ' '}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
