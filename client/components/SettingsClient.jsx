'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Spinner, useToast } from './ui';

export default function SettingsClient() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState({
    youcom_api_key: '',
    xai_api_key: '',
    xai_model: '',
    insforge_base_url: '',
    webhook_url: '',
  });
  const [revealed, setRevealed] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([api.getSettings(), api.health()]);
        setSettings(s);
        setHealth(h);
        setForm({
          youcom_api_key: s.youcom_api_key || '',
          xai_api_key: s.xai_api_key || '',
          xai_model: s.xai_model || 'grok-4',
          insforge_base_url: s.insforge_base_url || '',
          webhook_url: s.webhook_url || '',
        });
      } catch (err) {
        toast({ type: 'error', title: 'Failed to load settings', message: err.message });
      }
    })();
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const toggleReveal = (field) => setRevealed((r) => ({ ...r, [field]: !r[field] }));

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings({
        youcom_api_key: form.youcom_api_key,
        xai_api_key: form.xai_api_key,
        xai_model: form.xai_model,
        webhook_url: form.webhook_url,
      });
      // Re-fetch health to update status indicators.
      const h = await api.health();
      setHealth(h);
      toast({ type: 'success', title: 'Settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!settings || !health) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Spinner /> <span className="ml-2 text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">API keys, alerts, and monitoring configuration.</p>
      </header>

      {/* You.com */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">You.com API</h2>
          <StatusBadge ok={health.youcom_key} />
        </div>
        <p className="text-xs text-slate-500">
          Used for competitor discovery (Research API) and pricing page fetching (Contents API).
        </p>
        <SecretInput
          label="YOUCOM_API_KEY"
          value={form.youcom_api_key}
          onChange={set('youcom_api_key')}
          revealed={revealed.youcom_api_key}
          onToggle={() => toggleReveal('youcom_api_key')}
          placeholder="yk-…"
        />
      </section>

      {/* xAI / Grok */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">xAI (Grok) API</h2>
          <StatusBadge ok={health.xai_key} />
        </div>
        <p className="text-xs text-slate-500">
          Used to extract structured competitors from research and analyze pricing diffs.
        </p>
        <SecretInput
          label="XAI_API_KEY"
          value={form.xai_api_key}
          onChange={set('xai_api_key')}
          revealed={revealed.xai_api_key}
          onToggle={() => toggleReveal('xai_api_key')}
          placeholder="xai-…"
        />
        <div>
          <label className="label">XAI_MODEL</label>
          <input
            className="input font-mono text-xs"
            value={form.xai_model}
            onChange={set('xai_model')}
            placeholder="grok-4"
          />
          <p className="mt-1 text-xs text-slate-500">
            Active model: <span className="text-slate-300 font-mono">{health.model}</span>
          </p>
        </div>
      </section>

      {/* Insforge */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Insforge (Database)</h2>
          <span className="chip border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
            <Icon name="check" className="h-3 w-3" /> connected
          </span>
        </div>
        <p className="text-xs text-slate-500">
          PostgreSQL backend via Insforge SDK.{' '}
          <span className="font-mono text-slate-400">{form.insforge_base_url}</span>
        </p>
      </section>

      {/* Change alerts */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Change alerts</h2>
        <p className="text-sm text-slate-400">
          POST a summary to a webhook when a pricing change is detected. Works with Slack and Discord
          incoming webhooks out of the box.
        </p>
        <div>
          <label className="label">Webhook URL</label>
          <input
            className="input font-mono text-xs"
            placeholder="https://hooks.slack.com/services/…"
            value={form.webhook_url}
            onChange={set('webhook_url')}
          />
          <p className="mt-1.5 text-xs text-slate-500">Leave blank to disable outbound alerts.</p>
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Spinner /> : <Icon name="check" />} Save settings
        </button>
      </div>

      {settings.auto_refresh_enabled !== undefined && (
        <section className="card p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Auto-refresh (every 24 h)</span>
            <span className={`chip ${settings.auto_refresh_enabled
              ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
              : 'border-ink-700 bg-ink-850 text-slate-400'}`}>
              {settings.auto_refresh_enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Controlled by <span className="font-mono text-slate-400">AUTO_REFRESH_ENABLED</span> in .env.
          </p>
        </section>
      )}

      {settings.market && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Detected market</h2>
          <p className="mt-2 text-sm text-slate-300">{settings.market}</p>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ ok }) {
  return ok ? (
    <span className="chip border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
      <Icon name="check" className="h-3 w-3" /> connected
    </span>
  ) : (
    <span className="chip border-rose-800/60 bg-rose-950/40 text-rose-300">
      <Icon name="x" className="h-3 w-3" /> missing
    </span>
  );
}

function SecretInput({ label, value, onChange, revealed, onToggle, placeholder }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          className="input font-mono text-xs pr-10"
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <Icon name={revealed ? 'eye-off' : 'eye'} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
