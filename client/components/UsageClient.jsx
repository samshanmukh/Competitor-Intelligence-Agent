'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

export default function UsageClient() {
  const [usage, setUsage] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.getFeatureUsage();
      setUsage(res.usage || { totals: {}, events: [] });
    } catch (err) {
      toast({ type: 'error', title: 'Could not load usage', message: err.message });
      setUsage({ totals: {}, events: [] });
    }
  };

  useEffect(() => { load(); }, []);

  const exportWorkspace = async () => {
    setExporting(true);
    try {
      const snapshot = await api.exportWorkspace();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mira-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ type: 'success', title: 'Workspace export ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not export workspace', message: err.message });
    } finally {
      setExporting(false);
    }
  };

  const clearRetention = async () => {
    if (!window.confirm('Clear notifications, evidence, war room, win/loss, and usage history?')) return;
    setClearing(true);
    try {
      await api.clearRetention();
      await load();
      toast({ type: 'success', title: 'Retention data cleared' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not clear retention data', message: err.message });
    } finally {
      setClearing(false);
    }
  };

  const totals = usage?.totals || {};
  const events = usage?.events || [];

  return (
    <LabShell
      title="Usage"
      subtitle="See feature lab activity, export workspace data, and clear retained history."
      action={<div className="flex gap-2">
        <button onClick={exportWorkspace} disabled={exporting} className="btn-ghost text-sm">
          {exporting ? <Spinner /> : <Icon name="download" className="h-4 w-4" />}
          Export workspace
        </button>
        <button onClick={clearRetention} disabled={clearing} className="btn-ghost text-sm text-rose-700 hover:text-rose-200">
          {clearing ? <Spinner /> : <Icon name="trash" className="h-4 w-4" />}
          Clear retention
        </button>
      </div>}
    >
      {!usage ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
      ) : (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            {Object.entries(totals).length === 0 ? (
              <div className="card p-5 sm:col-span-3">
                <p className="text-sm text-ink-soft">No metered lab usage yet.</p>
              </div>
            ) : (
              Object.entries(totals).map(([key, value]) => (
                <div key={key} className="card p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{key.replace(/_/g, ' ')}</p>
                  <p className="mt-2 text-2xl font-bold text-ink tabular-nums">{value}</p>
                </div>
              ))
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-ink">Recent events</h2>
            {events.length === 0 ? (
              <EmptyState icon="activity" title="No usage events">Generate a lab output to populate usage history.</EmptyState>
            ) : (
              <div className="mt-4 divide-y divide-ink-800">
                {events.slice(0, 30).map((event, i) => (
                  <div key={`${event.type || event.feature}-${event.at || i}`} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{(event.type || event.feature || 'event').replace(/_/g, ' ')}</p>
                      {event.at && <p className="text-xs text-ink-soft">{new Date(event.at).toLocaleString()}</p>}
                    </div>
                    {event.count != null && <span className="chip border-ink-700 bg-ink-850 text-ink-soft">{event.count}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </LabShell>
  );
}
