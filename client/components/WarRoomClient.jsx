'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

const STAGES = ['discovery', 'evaluation', 'proposal', 'procurement', 'closed-won', 'closed-lost'];

export default function WarRoomClient() {
  const [deals, setDeals] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ title: '', competitor: '', stage: 'discovery', notes: '', talkTrack: '' });
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.listWarRoom();
      setDeals(res.deals || []);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load war room', message: err.message });
      setDeals([]);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const create = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await api.createWarRoomDeal({ ...form, title: form.title.trim() });
      setDeals(res.deals || []);
      setForm({ title: '', competitor: '', stage: 'discovery', notes: '', talkTrack: '' });
      toast({ type: 'success', title: 'Deal added' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not add deal', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (deal, stage) => {
    setBusyId(deal.id);
    try {
      const res = await api.updateWarRoomDeal(deal.id, { stage });
      setDeals(res.deals || []);
      toast({ type: 'success', title: 'Stage updated' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not update stage', message: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    setBusyId(id);
    try {
      const res = await api.deleteWarRoomDeal(id);
      setDeals(res.deals || []);
      toast({ type: 'success', title: 'Deal deleted' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not delete deal', message: err.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <LabShell title="War Room" subtitle="Track competitive deals and keep the stage, talk track, and risk visible.">
      <section className="card p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Deal name"><input className="input" value={form.title} onChange={set('title')} placeholder="Acme renewal, Series B evaluation..." /></Field>
          <Field label="Competitor"><input className="input" value={form.competitor} onChange={set('competitor')} placeholder="Optional" /></Field>
          <Field label="Stage">
            <select className="input" value={form.stage} onChange={set('stage')}>
              {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className="input min-h-20 resize-y" value={form.notes} onChange={set('notes')} placeholder="What matters in this deal?" /></Field>
        <Field label="Talk track"><textarea className="input min-h-20 resize-y" value={form.talkTrack} onChange={set('talkTrack')} placeholder="How should the team handle the competitive angle?" /></Field>
        <button onClick={create} disabled={saving || !form.title.trim()} className="btn-primary">
          {saving ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />}
          {saving ? 'Creating...' : 'Create deal card'}
        </button>
      </section>

      {deals === null ? (
        <div className="space-y-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : deals.length === 0 ? (
        <EmptyState icon="card" title="No active deal cards">Create cards for competitive deals that need founder attention.</EmptyState>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          {deals.map((deal) => (
            <div key={deal.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">{deal.title}</h2>
                  {deal.competitor && <p className="mt-1 text-xs text-slate-500">vs {deal.competitor}</p>}
                </div>
                <button onClick={() => remove(deal.id)} disabled={busyId === deal.id} className="text-slate-600 transition hover:text-rose-400">
                  <Icon name={busyId === deal.id ? 'refresh' : 'trash'} className={`h-4 w-4 ${busyId === deal.id ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <select className="input mt-4" value={deal.stage || 'discovery'} onChange={(e) => updateStage(deal, e.target.value)} disabled={busyId === deal.id}>
                {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
              {deal.notes && <p className="mt-3 text-sm text-slate-400">{deal.notes}</p>}
              {deal.talkTrack && (
                <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">Talk track</p>
                  <p className="mt-1 text-sm text-slate-300">{deal.talkTrack}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </LabShell>
  );
}

function Field({ label, children }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
