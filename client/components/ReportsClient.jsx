'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Skeleton, EmptyState, timeAgo, useToast, ConfirmDialog } from './ui';
import ReportView from './ReportView';

export default function ReportsClient() {
  const [reports, setReports] = useState(null);
  const [active, setActive] = useState(null);   // { ...report, content }
  const [loadingId, setLoadingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const { reports } = await api.listReports();
      setReports(reports || []);
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load history', message: err.message });
      setReports([]);
    }
  };

  useEffect(() => { load(); }, []);

  const open = async (id) => {
    setLoadingId(id);
    try {
      const { report } = await api.getReport(id);
      setActive(report);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not open report', message: err.message });
    } finally {
      setLoadingId(null);
    }
  };

  const del = async (id) => {
    try {
      await api.deleteReport(id);
      setReports((r) => r.filter((x) => x.id !== id));
      if (active?.id === id) setActive(null);
      toast({ type: 'success', title: 'Deleted' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not delete', message: err.message });
    }
  };

  // Viewing a single saved report
  if (active) {
    const c = active.content || {};
    return (
      <div className="max-w-3xl space-y-6 pb-20">
        <button onClick={() => setActive(null)} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition">
          <Icon name="chevronLeft" className="h-4 w-4" /> Back to history
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{active.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Saved {timeAgo(active.created_at)} · {c.competitors?.length || 0} competitors · cached (no re-run)
            </p>
          </div>
          <button onClick={() => setConfirmDelete(active.id)} className="btn-danger px-2.5">
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>

        {c.competitors ? (
          <div className="card p-5">
            <ReportView
              competitors={c.competitors}
              matrix={c.matrix}
              positioning={c.positioning}
              reviews={c.reviews}
              take={c.take}
            />
          </div>
        ) : (
          <EmptyState icon="alert" title="Report data unavailable">
            This saved report couldn't be read.
          </EmptyState>
        )}

        <ConfirmDialog
          open={confirmDelete !== null}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => del(confirmDelete)}
          title="Delete report"
          message="Permanently delete this saved report?"
          danger
        />
      </div>
    );
  }

  const loading = reports === null;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Report History</h1>
        <p className="mt-1 text-sm text-slate-500">
          Saved analyses you can reopen anytime — no re-running, no extra tokens spent.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : reports.length === 0 ? (
        <EmptyState icon="share" title="No saved reports yet" action={
          <a href="/app" className="btn-primary">Run an analysis</a>
        }>
          Run a full analysis on the Analysis page, then click <strong className="text-slate-300">Save to history</strong> to keep it here.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 p-4 hover:border-ink-600 transition">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-soft">
                <Icon name="bar" className="h-4 w-4" />
              </div>
              <button onClick={() => open(r.id)} className="flex-1 min-w-0 text-left">
                <p className="truncate text-sm font-medium text-white">{r.title}</p>
                <p className="text-xs text-slate-500">Saved {timeAgo(r.created_at)}</p>
              </button>
              {loadingId === r.id && <Icon name="refresh" className="h-4 w-4 animate-spin text-slate-500" />}
              <button onClick={() => open(r.id)} className="btn-ghost py-1.5 px-3 text-xs">Open</button>
              <button onClick={() => setConfirmDelete(r.id)} className="text-slate-600 hover:text-rose-400 transition p-1.5">
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => del(confirmDelete)}
        title="Delete report"
        message="Permanently delete this saved report?"
        danger
      />
    </div>
  );
}
