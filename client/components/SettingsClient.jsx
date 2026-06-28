'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Spinner, useToast } from './ui';

export default function SettingsClient() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [webhook, setWebhook] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([api.getSettings(), api.health()]);
        setSettings(s);
        setHealth(h);
        setWebhook(s.webhook_url || '');
      } catch (err) {
        toast({ type: 'error', title: 'Failed to load settings', message: err.message });
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings({ webhook_url: webhook });
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
        <p className="mt-1 text-sm text-slate-400">API status, alerts, and monitoring configuration.</p>
      </header>

      {/* API keys status */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">API keys</h2>
        <div className="mt-4 space-y-3">
          <KeyRow label="You.com API" ok={health.youcom_key} hint="Set YOUCOM_API_KEY in .env" />
          <KeyRow label="xAI (Grok) API" ok={health.xai_key} hint="Set XAI_API_KEY in .env" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Analysis model</span>
            <span className="chip border-ink-700 bg-ink-850 text-slate-300">{health.model}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Auto-refresh (every 24h)</span>
            <span className={`chip ${settings.auto_refresh_enabled
              ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
              : 'border-ink-700 bg-ink-850 text-slate-400'}`}>
              {settings.auto_refresh_enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Keys are read from the server <span className="font-mono text-slate-400">.env</span> file.
          Restart the server after changing them.
        </p>
      </section>

      {/* Webhook */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Change alerts</h2>
        <p className="mt-2 text-sm text-slate-400">
          POST a summary to a webhook when a pricing change is detected. Works with Slack and Discord
          incoming webhooks out of the box.
        </p>
        <div className="mt-4">
          <label className="label">Webhook URL</label>
          <input
            className="input font-mono text-xs"
            placeholder="https://hooks.slack.com/services/…"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate-500">Leave blank to disable outbound alerts.</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Spinner /> : <Icon name="check" />} Save settings
          </button>
        </div>
      </section>

      {settings.market && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Detected market</h2>
          <p className="mt-2 text-sm text-slate-300">{settings.market}</p>
        </section>
      )}
    </div>
  );
}

function KeyRow({ label, ok, hint }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      {ok ? (
        <span className="chip border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
          <Icon name="check" className="h-3 w-3" /> connected
        </span>
      ) : (
        <span className="chip border-rose-800/60 bg-rose-950/40 text-rose-300" title={hint}>
          <Icon name="x" className="h-3 w-3" /> missing
        </span>
      )}
    </div>
  );
}
