'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, ImpactBadge, StatusDot, Skeleton, EmptyState, ValueScore, timeAgo, useToast, ConfirmDialog } from './ui';

export default function CompetitorsClient() {
  const [competitors, setCompetitors] = useState(null);
  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState('approved');
  const [refreshingId, setRefreshingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const { competitors } = await api.listCompetitors(filter || undefined);
      setCompetitors(competitors || []);
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load', message: err.message });
    }
  };

  useEffect(() => { setCompetitors(null); load(); }, [filter]);

  const refresh = async (id) => {
    setRefreshingId(id);
    try {
      await api.refreshOne(id);
      toast({ type: 'success', title: 'Refreshed' });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Refresh failed', message: err.message });
    } finally {
      setRefreshingId(null);
    }
  };

  const del = async (id) => {
    try {
      await api.deleteCompetitor(id);
      setCompetitors((cs) => cs.filter((c) => c.id !== id));
      toast({ type: 'success', title: 'Deleted' });
    } catch (err) {
      toast({ type: 'error', title: 'Failed to delete', message: err.message });
    }
  };

  const approve = async (id) => {
    await api.setStatus(id, 'approved');
    setCompetitors((cs) => cs.map((c) => c.id === id ? { ...c, status: 'approved' } : c));
  };

  const loading = competitors === null;
  const list = competitors || [];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Competitors</h1>
          <p className="mt-1 text-sm text-slate-500">{loading ? '…' : `${list.length} ${filter || 'total'}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-700 bg-ink-900 p-0.5">
            {['approved', 'pending', ''].map((f, i) => (
              <button
                key={i}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  filter === f ? 'bg-ink-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
          <button onClick={() => setView(view === 'grid' ? 'list' : 'grid')} className="btn-ghost p-2">
            <Icon name={view === 'grid' ? 'list' : 'grid'} className="h-4 w-4" />
          </button>
          <Link href="/discover" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Add
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon="users" title="No competitors" action={
          <Link href="/discover" className="btn-primary">Discover competitors</Link>
        }>
          Start by discovering competitors in your market.
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-sm font-bold text-slate-400">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/competitors/${c.id}`} className="block truncate text-sm font-semibold text-white hover:text-accent-soft transition">
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusDot competitor={c} />
                      <span className="text-[10px] text-slate-600">{c.last_checked_at ? timeAgo(c.last_checked_at) : 'never'}</span>
                    </div>
                  </div>
                </div>
                <ValueScore score={c.value_score} />
              </div>

              {c.description && <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink-800">
                <span className="text-xs text-slate-600">{c.changeCount || 0} changes</span>
                <div className="flex items-center gap-1">
                  {c.status === 'pending' && (
                    <button onClick={() => approve(c.id)} className="btn-ghost py-1 px-2 text-xs">Approve</button>
                  )}
                  <button
                    onClick={() => refresh(c.id)}
                    disabled={refreshingId === c.id}
                    className="btn-ghost p-1.5"
                    title="Refresh"
                  >
                    <Icon name="refresh" className={`h-3.5 w-3.5 ${refreshingId === c.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => setConfirmDelete(c.id)} className="btn-ghost p-1.5 hover:text-rose-400" title="Delete">
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Competitor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 hidden lg:table-cell">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Changes</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 hidden md:table-cell">Last Checked</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-ink-850/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusDot competitor={c} />
                      <Link href={`/competitors/${c.id}`} className="font-medium text-white hover:text-accent-soft transition">{c.name}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`chip text-[10px] ${
                      c.status === 'approved' ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-400' :
                      c.status === 'pending' ? 'border-amber-800/50 bg-amber-950/30 text-amber-400' :
                      'border-slate-700 bg-ink-800 text-slate-500'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell"><ValueScore score={c.value_score} /></td>
                  <td className="px-4 py-3 text-slate-400">{c.changeCount || 0}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">{c.last_checked_at ? timeAgo(c.last_checked_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => refresh(c.id)} disabled={refreshingId === c.id} className="text-slate-500 hover:text-white transition p-1">
                        <Icon name="refresh" className={`h-3.5 w-3.5 ${refreshingId === c.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => setConfirmDelete(c.id)} className="text-slate-600 hover:text-rose-400 transition p-1">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => del(confirmDelete)}
        title="Delete competitor"
        message="This will remove the competitor and all its snapshots. This cannot be undone."
        danger
      />
    </div>
  );
}
