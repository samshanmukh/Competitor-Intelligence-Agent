'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';

export default function PricingLabClient() {
  const [form, setForm] = useState({ planName: '', deltaPct: 10, absolutePrice: '' });
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const toast = useToast();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const simulate = async () => {
    setRunning(true);
    try {
      const res = await api.simulatePricing({
        planName: form.planName.trim() || 'primary plan',
        deltaPct: Number(form.deltaPct) || 0,
        absolutePrice: form.absolutePrice === '' ? null : Number(form.absolutePrice),
      });
      setResult(res.result || null);
      toast({ type: 'success', title: 'Pricing scenario ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not simulate pricing', message: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <LabShell title="Pricing simulator" subtitle="Model a plan change against your current competitive posture.">
      <LabPanel>
        <div className="space-y-4">
          <div>
            <label htmlFor="pricing-plan-name" className="label">Plan name</label>
            <input id="pricing-plan-name" className="input" value={form.planName} onChange={set('planName')} placeholder="Pro, Growth, Business..." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pricing-delta" className="label">Delta %</label>
              <input id="pricing-delta" type="number" className="input" value={form.deltaPct} onChange={set('deltaPct')} />
            </div>
            <div>
              <label htmlFor="pricing-absolute" className="label">Absolute price (optional)</label>
              <input id="pricing-absolute" type="number" className="input" value={form.absolutePrice} onChange={set('absolutePrice')} placeholder="99" />
            </div>
          </div>
          <button onClick={simulate} disabled={running} className="btn-primary">
            <Icon name={running ? 'refresh' : 'bar'} className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Simulating...' : 'Simulate pricing'}
          </button>
        </div>
      </LabPanel>

      {running && (
        <LabPanel title="Simulating">
          <LabShimmerBlock rows={3} />
        </LabPanel>
      )}

      {!running && !result ? (
        <EmptyState icon="card" title="No pricing scenario yet">Run a scenario to see upside, downside, and packaging recommendations.</EmptyState>
      ) : !running && result ? (
        <LabPanel>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scenario</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{result.scenario}</h2>
              <p className="mt-2 text-sm text-slate-400">{result.competitivePosition}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Mini label="New price" value={result.yourNewPrice || 'Not specified'} />
              <Mini label="Value scatter" value={result.valueScatterNote || 'No note returned'} />
            </div>
            <List title="Upsides" items={result.upsides} />
            <List title="Downsides" items={result.downsides} />
            <List title="Suggested packaging" items={result.suggestedPackaging} />
            {result.recommendation && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">Recommendation</p>
                <p className="mt-2 text-sm text-slate-300">{result.recommendation}</p>
              </div>
            )}
          </div>
        </LabPanel>
      ) : null}
    </LabShell>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function List({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-400">
        {items.map((item, i) => <li key={i}>- {item}</li>)}
      </ul>
    </div>
  );
}
