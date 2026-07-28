'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';
import { SourceAttribution } from './SourceAttribution';

export default function EvidenceClient() {
  const [items, setItems] = useState(null);
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [engine, setEngine] = useState(null);
  const [attribution, setAttribution] = useState(null);
  const [form, setForm] = useState({ quote: '', source: '', theme: '', competitor: '', sentiment: 'neutral' });
  const [researchForm, setResearchForm] = useState({ query: '', competitor: '', theme: '' });
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
  const setR = (field) => (e) => setResearchForm((f) => ({ ...f, [field]: e.target.value }));

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

  const research = async () => {
    if (!researchForm.query.trim()) return;
    setResearching(true);
    setCandidates([]);
    setSelected(new Set());
    setEngine(null);
    setAttribution(null);
    try {
      const res = await api.researchEvidence({
        query: researchForm.query.trim(),
        competitor: researchForm.competitor.trim() || undefined,
        theme: researchForm.theme.trim() || undefined,
      });
      setCandidates(res.candidates || []);
      setEngine(res.engine || null);
      setAttribution(res.attribution || {
        skill: res.skill,
        skillLabel: res.skillLabel,
        engine: res.engine,
        sources: res.sources || [],
      });
      setSelected(new Set((res.candidates || []).map((c) => c.id)));
      if (!(res.candidates || []).length) toast({ type: 'info', title: 'No candidates found', message: 'Try a more specific query.' });
    } catch (err) {
      toast({ type: 'error', title: 'Research failed', message: err.message });
    } finally {
      setResearching(false);
    }
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveSelected = async () => {
    const picks = candidates.filter((c) => selected.has(c.id));
    if (!picks.length) return;
    setSavingBatch(true);
    try {
      const res = await api.saveEvidenceBatch(picks);
      setItems(res.items || []);
      setCandidates([]);
      setSelected(new Set());
      toast({ type: 'success', title: `Saved ${res.saved?.length || picks.length} proof points` });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save candidates', message: err.message });
    } finally {
      setSavingBatch(false);
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
    <LabShell
      title="Evidence"
      subtitle="Research buyer quotes and competitor proof points on the web, then save what you want to reuse."
      skills={[{ skill: 'you-web' }]}
    >
      <LabPanel
        title="Research & save"
        ready={candidates.length > 0 && !researching}
        skill={attribution?.skill || engine || 'you-web'}
        skillLabel={attribution?.skillLabel}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="What to find">
            <input
              className="input"
              value={researchForm.query}
              onChange={setR('query')}
              placeholder="e.g. pricing complaints, onboarding friction, security reviews"
              onKeyDown={(e) => { if (e.key === 'Enter') research(); }}
            />
          </Field>
          <Field label="Competitor (optional)">
            <input className="input" value={researchForm.competitor} onChange={setR('competitor')} placeholder="Notion" />
          </Field>
          <Field label="Theme (optional)">
            <input className="input" value={researchForm.theme} onChange={setR('theme')} placeholder="Pricing" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={research} disabled={researching || !researchForm.query.trim()} className="btn-primary">
            <Icon name={researching ? 'refresh' : 'search'} className={`h-4 w-4 ${researching ? 'animate-spin' : ''}`} />
            {researching ? 'Researching…' : 'Research web'}
          </button>
        </div>

        {researching && (
          <div className="mt-5">
            <LabShimmerBlock rows={3} />
          </div>
        )}

        {!researching && attribution && (
          <SourceAttribution attribution={attribution} engine={engine} />
        )}

        {!researching && candidates.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{candidates.length} candidates, select what to keep</p>
              <button onClick={saveSelected} disabled={savingBatch || selected.size === 0} className="btn-primary text-sm">
                {savingBatch ? 'Saving…' : `Save ${selected.size} selected`}
              </button>
            </div>
            {candidates.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  selected.has(item.id) ? 'border-accent/40 bg-accent/5' : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-slate-300">"{item.quote}"</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.sentiment && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.sentiment}</span>}
                    {item.theme && <span className="chip border-accent/30 bg-accent/10 text-accent-soft">{item.theme}</span>}
                    {item.competitor && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.competitor}</span>}
                    {item.source && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.source}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </LabPanel>

      <LabPanel title="Add manually">
        <div>
          <label htmlFor="evidence-quote" className="label">Quote or proof point</label>
          <textarea id="evidence-quote" className="input min-h-24 resize-y" value={form.quote} onChange={set('quote')} placeholder="Buyer quote, analyst note, pricing claim, review excerpt..." />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
        <button onClick={save} disabled={saving || !form.quote.trim()} className="btn-primary mt-4">
          <Icon name="plus" className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save evidence'}
        </button>
      </LabPanel>

      {items === null ? (
        <LabPanel><LabShimmerBlock rows={2} /></LabPanel>
      ) : items.length === 0 ? (
        <EmptyState icon="shield" title="No evidence saved yet">Research the web or add quotes your team keeps reaching for.</EmptyState>
      ) : (
        <LabPanel title="Saved locker" ready>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-slate-300">"{item.quote}"</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.sentiment && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.sentiment}</span>}
                      {item.theme && <span className="chip border-accent/30 bg-accent/10 text-accent-soft">{item.theme}</span>}
                      {item.competitor && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.competitor}</span>}
                      {item.source && <span className="chip border-ink-700 bg-ink-850 text-slate-400">{item.source}</span>}
                    </div>
                  </div>
                  <button type="button" aria-label="Delete evidence" onClick={() => remove(item.id)} disabled={deletingId === item.id} className="text-slate-600 transition hover:text-rose-400">
                    <Icon name={deletingId === item.id ? 'refresh' : 'trash'} className={`h-4 w-4 ${deletingId === item.id ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </LabPanel>
      )}
    </LabShell>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
