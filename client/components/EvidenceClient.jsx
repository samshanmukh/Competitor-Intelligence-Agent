'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

export default function EvidenceClient() {
  const [items, setItems] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ quote: '', source: '', theme: '', competitor: '', sentiment: 'neutral' });
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.listEvidence();
      setItems(res.items || []);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load evidence', message: err.message });
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    if (!form.quote.trim()) return;
    setSaving(true);
    try {
      const res = await api.createEvidence({ ...form, quote: form.quote.trim() });
      setItems(res.items || []);
      setForm({ quote: '', source: '', theme: '', competitor: '', sentiment: 'neutral' });
      toast({ type: 'success', title: 'Evidence saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save evidence', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setDeletingId(id);
    try {
      const res = await api.deleteEvidence(id);
      setItems(res.items || []);
      toast({ type: 'success', title: 'Evidence deleted' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not delete evidence', message: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <LabShell title="Evidence" subtitle="Store buyer quotes, source notes, and competitor proof points you can reuse in reports.">
      <section className="card p-5 space-y-4">
        <div>
          <label htmlFor="evidence-quote" className="label">Quote or proof point</label>
          <textarea id="evidence-quote" className="input min-h-24 resize-y" value={form.quote} onChange={set('quote')} placeholder="Buyer quote, analyst note, pricing claim, review excerpt..." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source"><input className="input" value={form.source} onChange={set('source')} placeholder="G2 review, sales call, URL" /></Field>
          <Field label="Theme"><input className="input" value={form.theme} onChange={set('theme')} placeholder="Security, onboarding, pricing" /></Field>
          <Field label="Competitor"><input className="input" value={form.competitor} onChange={set('competitor')} placeholder="Optional" /></Field>
          <Field label="Sentiment">
            <select className="input" value={form.sentiment} onChange={set('sentiment')}>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </Field>
        </div>
        <button onClick={save} disabled={saving || !form.quote.trim()} className="btn-primary">
          {saving ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save evidence'}
        </button>
      </section>

      {items === null ? (
        <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="shield" title="No evidence saved yet">Add the quotes and claims your team keeps reaching for.</EmptyState>
      ) : (
        <section className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-ink-soft">"{item.quote}"</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.sentiment && <span className="chip border-ink-700 bg-ink-850 text-ink-soft">{item.sentiment}</span>}
                    {item.theme && <span className="chip border-accent/30 bg-accent/10 text-accent">{item.theme}</span>}
                    {item.competitor && <span className="chip border-ink-700 bg-ink-850 text-ink-soft">{item.competitor}</span>}
                    {item.source && <span className="chip border-ink-700 bg-ink-850 text-ink-soft">{item.source}</span>}
                  </div>
                </div>
                <button type="button" aria-label="Delete evidence" onClick={() => remove(item.id)} disabled={deletingId === item.id} className="text-ink-faint transition hover:text-rose-700">
                  <Icon name={deletingId === item.id ? 'refresh' : 'trash'} className={`h-4 w-4 ${deletingId === item.id ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </LabShell>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
