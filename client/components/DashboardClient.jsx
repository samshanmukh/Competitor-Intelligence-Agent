'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, KpiCard, ImpactBadge, StatusDot, Skeleton, EmptyState, timeAgo, NotificationBell, useToast } from './ui';

export default function DashboardClient() {
  const [competitors, setCompetitors] = useState(null);
  const [changes, setChanges] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const toast = useToast();

  const load = async () => {
    try {
      const [compData, changeData] = await Promise.all([
        api.listCompetitors('approved'),
        api.changes(10),
      ]);
      setCompetitors(compData.competitors || []);
      setChanges((changeData.changes || []).map((c) => {
        try { return { ...c, analysis: typeof c.analysis === 'string' ? JSON.parse(c.analysis) : c.analysis }; } catch { return c; }
      }));
      setUnseen(changeData.unseen || 0);
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load dashboard', message: err.message });
    }
  };

  useEffect(() => { load(); api.recordVisit().catch(() => {}); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await api.refreshAll();
      const changed = (result.results || []).filter((r) => r.status === 'changed').length;
      toast({ type: 'success', title: 'Refresh complete', message: `${changed} change${changed !== 1 ? 's' : ''} detected` });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Refresh failed', message: err.message });
    } finally {
      setRefreshing(false);
    }
  };

  const loading = competitors === null;
  const approved = competitors || [];
  const changesThisWeek = (changes || []).filter((c) => {
    const d = new Date(c.detected_at);
    return (Date.now() - d.getTime()) < 7 * 86400 * 1000;
  });
  const highImpact = (changes || []).filter((c) => c.analysis?.impact === 'high');

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitoring {loading ? '…' : `${approved.length} competitor${approved.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell unseen={unseen} />
          <button onClick={handleRefresh} disabled={refreshing} className="btn-primary">
            <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh all'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard label="Competitors" value={approved.length} icon="users" color="accent" sub="tracked & approved" />
            <KpiCard label="Changes (7d)" value={changesThisWeek.length} icon="activity" color={changesThisWeek.length > 0 ? 'amber' : 'green'} sub="pricing events" />
            <KpiCard label="High Impact" value={highImpact.length} icon="alert" color={highImpact.length > 0 ? 'rose' : 'green'} sub="need attention" />
            <KpiCard label="Unread" value={unseen} icon="bell" color={unseen > 0 ? 'amber' : 'green'} sub={unseen > 0 ? 'new since last visit' : 'all caught up'} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Competitor list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Competitors</h2>
            <Link href="/competitors" className="text-xs text-accent-soft hover:text-white transition">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : approved.length === 0 ? (
            <EmptyState icon="users" title="No competitors yet" action={
              <Link href="/discover" className="btn-primary">Discover competitors</Link>
            }>
              Use Discover to find and track competitors in your market.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {approved.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/competitors/${c.id}`}
                  className="card flex items-center gap-3 p-3.5 hover:border-ink-600 transition group">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-sm font-bold text-slate-400">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot competitor={c} />
                      <span className="text-sm font-medium text-white truncate">{c.name}</span>
                      {c.value_score != null && (
                        <span className="ml-auto shrink-0 text-xs text-slate-500">{c.value_score}/10 value</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {c.last_checked_at ? `Checked ${timeAgo(c.last_checked_at)}` : 'Never checked'} · {c.changeCount || 0} changes
                    </p>
                  </div>
                  <Icon name="chevronRight" className="h-4 w-4 text-slate-700 group-hover:text-slate-400 transition" />
                </Link>
              ))}
              {approved.length > 6 && (
                <Link href="/competitors" className="block text-center py-2 text-xs text-slate-500 hover:text-slate-300 transition">
                  +{approved.length - 6} more
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Recent changes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Changes</h2>
            <Link href="/changes" className="text-xs text-accent-soft hover:text-white transition">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !(changes?.length) ? (
            <div className="card p-4 text-center text-sm text-slate-500">
              No changes yet. Run a refresh to check pricing pages.
            </div>
          ) : (
            <div className="space-y-2">
              {(changes || []).slice(0, 6).map((c) => (
                <Link key={c.id} href="/changes" className="card block p-3 hover:border-ink-600 transition">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-300 truncate">{c.competitor_name || '—'}</span>
                    <ImpactBadge impact={c.analysis?.impact} />
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{c.analysis?.summary || c.summary || 'Pricing page updated'}</p>
                  <p className="mt-1 text-[10px] text-slate-600">{timeAgo(c.detected_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { href: '/discover', icon: 'search', label: 'Discover', desc: 'Find new competitors' },
            { href: '/compare', icon: 'bar', label: 'Compare', desc: 'Side-by-side analysis' },
            { href: '/my-product', icon: 'shield', label: 'My Product', desc: 'Gap analysis' },
            { href: '/reports', icon: 'share', label: 'Reports', desc: 'Export insights' },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="card p-4 hover:border-ink-600 transition group">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800 text-accent-soft group-hover:bg-accent/15 transition">
                <Icon name={a.icon} className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-white">{a.label}</p>
              <p className="text-xs text-slate-500">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
