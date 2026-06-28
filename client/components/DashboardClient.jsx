'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  EmptyState, Icon, ImpactBadge, Spinner, StatusDot, timeAgo, useToast,
} from './ui';

export default function DashboardClient() {
  const [competitors, setCompetitors] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const [{ competitors }, { changes }] = await Promise.all([
        api.listCompetitors('approved'),
        api.changes(50),
      ]);
      setCompetitors(competitors);
      setChanges(changes);
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const { results } = await api.refreshAll();
      const changed = results.filter((r) => r.status === 'changed');
      const errored = results.filter((r) => r.status === 'error');
      toast({
        type: changed.length ? 'success' : 'info',
        title: changed.length ? `${changed.length} pricing change(s) detected` : 'All up to date',
        message: errored.length ? `${errored.length} page(s) could not be fetched.` : 'Snapshots refreshed.',
      });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Refresh failed', message: err.message });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Spinner /> <span className="ml-2 text-sm">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitoring {competitors.length} competitor{competitors.length === 1 ? '' : 's'}.
          </p>
        </div>
        {competitors.length > 0 && (
          <div className="flex items-center gap-2">
            <Link href="/discover" className="btn-ghost">
              <Icon name="plus" /> Add competitors
            </Link>
            <button onClick={refreshAll} disabled={refreshing} className="btn-primary">
              {refreshing ? <Spinner /> : <Icon name="refresh" />}
              {refreshing ? 'Refreshing…' : 'Refresh all'}
            </button>
          </div>
        )}
      </header>

      {competitors.length === 0 ? (
        <EmptyState
          icon="radar"
          title="No competitors yet"
          action={
            <Link href="/discover" className="btn-primary">
              <Icon name="search" /> Discover competitors
            </Link>
          }
        >
          Tell the agent what you build — in plain English, with your product URL, or by pasting
          competitor pricing pages. It'll find competitors, snapshot their pricing, and flag every change.
        </EmptyState>
      ) : (
        <>
          <CompetitorTable competitors={competitors} onRefreshed={load} />
          {changes.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Recent changes
                </h2>
                <Link href="/changes" className="text-xs text-accent-soft hover:underline">
                  View all
                </Link>
              </div>
              <ChangeFeed changes={changes.slice(0, 5)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CompetitorTable({ competitors, onRefreshed }) {
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();

  const refreshOne = async (e, id) => {
    e.preventDefault();
    setBusyId(id);
    try {
      const { result } = await api.refreshOne(id);
      const map = {
        changed: { type: 'success', title: 'Change detected', message: result.summary },
        unchanged: { type: 'info', title: 'No change', message: 'Identical to last snapshot.' },
        first_snapshot: { type: 'success', title: 'First snapshot saved' },
        error: { type: 'error', title: 'Fetch failed', message: result.error },
      };
      toast(map[result.status] || { title: 'Done' });
      onRefreshed();
    } catch (err) {
      toast({ type: 'error', title: 'Refresh failed', message: err.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">Competitor</th>
            <th className="px-4 py-3 font-medium">Last checked</th>
            <th className="px-4 py-3 font-medium">Last change</th>
            <th className="px-4 py-3 font-medium">Changes</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {competitors.map((c) => (
            <tr key={c.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/50">
              <td className="px-4 py-3">
                <Link href={`/competitors/${c.id}`} className="flex items-center gap-2.5">
                  <StatusDot competitor={c} />
                  <div>
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="max-w-[260px] truncate text-xs text-slate-500">{c.pricing_url}</div>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-400">
                {c.last_error ? (
                  <span className="chip border-rose-800/60 bg-rose-950/40 text-rose-300">fetch error</span>
                ) : (
                  timeAgo(c.last_checked_at)
                )}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {c.last_changed_at ? timeAgo(c.last_changed_at) : <span className="text-slate-600">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-400">{c.changeCount || 0}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={(e) => refreshOne(e, c.id)}
                  disabled={busyId === c.id}
                  className="btn-ghost px-2.5 py-1.5"
                  title="Refresh"
                >
                  {busyId === c.id ? <Spinner /> : <Icon name="refresh" />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChangeFeed({ changes }) {
  if (!changes.length) {
    return (
      <EmptyState icon="bell" title="No changes detected yet">
        Once you refresh, the agent diffs each pricing page against its last snapshot and Grok
        summarizes exactly what moved — plan names, price points, features added or removed.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      {changes.map((ch) => (
        <Link
          key={ch.id}
          href={`/competitors/${ch.competitor_id}`}
          className="card block px-4 py-3.5 transition hover:border-ink-600"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{ch.competitor_name}</span>
                {ch.analysis?.impact && <ImpactBadge impact={ch.analysis.impact} />}
                {!ch.seen && (
                  <span className="chip border-accent/40 bg-accent/10 text-accent-soft">new</span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-300">{ch.summary || ch.analysis?.summary}</p>
              <ChangeTags analysis={ch.analysis} />
            </div>
            <div className="shrink-0 text-xs text-slate-500">{timeAgo(ch.detected_at)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ChangeTags({ analysis }) {
  if (!analysis) return null;
  const tags = [];
  (analysis.price_changes || []).forEach((p) =>
    tags.push(`${p.plan || 'Plan'}: ${p.old_price || '?'} → ${p.new_price || '?'}`)
  );
  (analysis.plans_added || []).forEach((p) => tags.push(`+ plan: ${p}`));
  (analysis.plans_removed || []).forEach((p) => tags.push(`− plan: ${p}`));
  (analysis.features_added || []).slice(0, 3).forEach((f) => tags.push(`+ ${f}`));
  (analysis.features_removed || []).slice(0, 3).forEach((f) => tags.push(`− ${f}`));
  if (!tags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.slice(0, 6).map((t, i) => (
        <span key={i} className="chip border-ink-700 bg-ink-850 text-slate-400">{t}</span>
      ))}
    </div>
  );
}
