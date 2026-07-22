'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

export default function WinLossClient() {
  const [entries, setEntries] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ notes: '', outcome: 'unknown', competitor: '' });
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.listWinLoss();
      setEntries(res.entries || []);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load win/loss notes', message: err.message });
      setEntries([]);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    if (!form.notes.trim()) return;
    setSaving(true);
    try {
      const res = await api.createWinLoss({ ...form, notes: form.notes.trim() });
      setEntries(res.entries || []);
      setForm({ notes: '', outcome: 'unknown', competitor: '' });
      toast({ type: 'success', title: 'Win/loss insight saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not analyze notes', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <LabShell title="Win / loss" subtitle="Turn sales notes into objections, talk tracks, and battlecard updates.">
      <section className="card p-5 space-y-4">
        <div>
          <label htmlFor="win-loss-notes" className="label">Deal notes</label>
          <textarea id="win-loss-notes" className="input min-h-28 resize-y" value={form.notes} onChange={set('notes')} placeholder="Paste the call notes, buyer objection, or closed-lost recap..." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="win-loss-outcome" className="label">Outcome</label>
            <select id="win-loss-outcome" className="input" value={form.outcome} onChange={set('outcome')}>
              <option value="unknown">Unknown</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <label htmlFor="win-loss-competitor" className="label">Competitor (optional)</label>
            <input id="win-loss-competitor" className="input" value={form.competitor} onChange={set('competitor')} placeholder="Competitor named by buyer" />
          </div>
        </div>
        <button onClick={save} disabled={saving || !form.notes.trim()} className="btn-primary">
          {saving ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}
          {saving ? 'Analyzing...' : 'Analyze note'}
        </button>
      </section>

      {entries === null ? (
        <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon="list" title="No win/loss notes yet">Add a note above to start building your buyer objection library.</EmptyState>
      ) : (
        <section className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip border-ink-700 bg-ink-850 text-ink-soft">{entry.outcome || 'unknown'}</span>
                {entry.competitor && <span className="chip border-accent/30 bg-accent/10 text-accent">{entry.competitor}</span>}
              </div>
              <p className="mt-3 text-sm text-ink-soft">{entry.analysis?.summary || entry.notes}</p>
              {entry.analysis?.objections?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Objections</p>
                  <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                    {entry.analysis.objections.map((item, i) => <li key={i}>- {item}</li>)}
                  </ul>
                </div>
              )}
              {entry.analysis?.talkTracks?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Talk tracks</p>
                  <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                    {entry.analysis.talkTracks.map((item, i) => <li key={i}>- {item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </LabShell>
  );
}
