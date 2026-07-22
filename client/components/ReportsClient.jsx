'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Skeleton, EmptyState, timeAgo, useToast, ConfirmDialog } from './ui';
import ReportView from './ReportView';
import { PageHeader, PageShell } from './PageShell';

export default function ReportsClient() {
  const [reports, setReports] = useState(null);
  const [active, setActive] = useState(null);   // { ...report, content }
  const [distributionDiff, setDistributionDiff] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const toast = useToast();

  const copyShareLink = async (report) => {
    if (!report?.token) {
      toast({ type: 'error', title: 'No share link', message: 'This report has no share token.' });
      return;
    }
    const url = `${window.location.origin}/reports/shared/${report.token}`;
    try {
      await navigator.clipboard?.writeText(url);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
      const expiry = report.expires_at ? new Date(report.expires_at).toLocaleDateString() : null;
      toast({
        type: 'success',
        title: 'Link copied',
        message: expiry ? `Anyone with the link can view it until ${expiry}.` : 'Anyone with the link can view this report.',
      });
    } catch {
      toast({ type: 'error', title: 'Could not copy', message: url });
    }
  };

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
    setDistributionDiff(null);
    try {
      const [{ report }, diffRes] = await Promise.all([
        api.getReport(id),
        api.reportDistributionDiff(id).catch(() => ({ diff: null })),
      ]);
      setActive(report);
      if (diffRes?.diff?.available && diffRes.diff.shifts?.length) setDistributionDiff(diffRes.diff);
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
      <div className="mx-auto w-full max-w-3xl space-y-6 pb-20">
        <button onClick={() => setActive(null)} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition">
          <Icon name="chevronLeft" className="h-4 w-4" /> Back to history
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{active.title}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Saved {timeAgo(active.created_at)} · {c.competitors?.length || 0} competitors · cached (no re-run)
            </p>
            {active.expires_at && (
              <p className="mt-1 text-xs text-ink-faint">
                Share link expires {new Date(active.expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => copyShareLink(active)} className="btn-ghost px-2.5" title="Copy share link">
              <Icon name="share" className="h-4 w-4" />
              <span className="ml-1.5 text-xs">{copiedId === active.id ? 'Copied' : 'Share'}</span>
            </button>
            <button onClick={() => setConfirmDelete(active.id)} className="btn-danger px-2.5">
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {distributionDiff?.shifts?.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Since this report</p>
            <p className="mt-1 text-sm text-ink-soft">{distributionDiff.summary}</p>
          </div>
        )}

        {c.competitors ? (
          <div className="card p-5">
            <ReportView
              competitors={c.competitors}
              matrix={c.matrix}
              positioning={c.positioning}
              reviews={c.reviews}
              take={c.take}
              market={c.market}
              product={c.product}
              strategy={c.strategy}
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
    <PageShell>
      <PageHeader
        title="History"
        description="Saved analyses you can reopen anytime — no re-running, no extra tokens spent."
      />

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : reports.length === 0 ? (
        <EmptyState icon="share" title="No saved reports yet" action={
          <a href="/app" className="btn-primary">Run an analysis</a>
        }>
          Run a full analysis on the Analysis page, then click <strong className="text-ink-soft">Save to history</strong> to keep it here.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 p-4 hover:border-ink-600 transition">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon name="bar" className="h-4 w-4" />
              </div>
              <button onClick={() => open(r.id)} className="flex-1 min-w-0 text-left">
                <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                <p className="text-xs text-ink-soft">
                  Saved {timeAgo(r.created_at)}
                  {r.expires_at ? ` · share expires ${new Date(r.expires_at).toLocaleDateString()}` : ''}
                </p>
              </button>
              {loadingId === r.id && <Icon name="refresh" className="h-4 w-4 animate-spin text-ink-soft" />}
              <button onClick={() => copyShareLink(r)} className="btn-ghost py-1.5 px-2 text-xs" title="Copy share link">
                {copiedId === r.id ? 'Copied' : 'Share'}
              </button>
              <button onClick={() => open(r.id)} className="btn-ghost py-1.5 px-3 text-xs">Open</button>
              <button onClick={() => setConfirmDelete(r.id)} className="text-ink-faint hover:text-rose-700 transition p-1.5">
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
    </PageShell>
  );
}
