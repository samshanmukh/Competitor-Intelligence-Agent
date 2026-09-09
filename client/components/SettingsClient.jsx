'use client';

import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace } from '../lib/auth';
import { Icon, Skeleton, TabBar, useToast } from './ui';
import { PageHeader, PageShell } from './PageShell';

const providerHealth = (settings, health = {}) => ({
  ...health,
  youcom_key: Boolean(settings?.youcom_key_set),
});

export default function SettingsClient() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({
    youcom_api_key: '', webhook_url: '',
  });
  const [revealed, setRevealed] = useState({});
  const [saving, setSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ any: true, highImpact: true, newCompetitor: false, digest: false });
  const [digest, setDigest] = useState({ enabled: false, email: '' });
  const [digestPrefs, setDigestPrefs] = useState({ onlySignificant: true, topActions: 3, includeDistribution: true });
  const [savingDigest, setSavingDigest] = useState(false);
  const toast = useToast();

  const saveDigest = async () => {
    if (!workspace?.id) return;
    setSavingDigest(true);
    try {
      await api.updateWorkspace(workspace.id, { digest_enabled: digest.enabled, digest_email: digest.email });
      await api.saveDigestPrefs(digestPrefs);
      toast({ type: 'success', title: 'Digest settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSavingDigest(false);
    }
  };

  const sendTestDigest = async () => {
    if (!workspace?.id || !digest.email) return;
    try {
      const res = await api.digestTest(workspace.id, digest.email);
      if (res.sent) toast({ type: 'success', title: 'Test sent', message: `Check ${digest.email}` });
      else toast({ type: 'error', title: 'Not sent', message: res.reason === 'not_configured' ? 'Email not configured on the server (RESEND_API_KEY).' : res.reason });
    } catch (err) {
      toast({ type: 'error', title: 'Test failed', message: err.message });
    }
  };

  useEffect(() => {
    const ws = getWorkspace();
    setWorkspace(ws);
    (async () => {
      try {
        const [s, h] = await Promise.all([api.getSettings(), api.health()]);
        setSettings(s);
        setHealth(providerHealth(s, h));
        setForm({
          youcom_api_key: s.youcom_api_key || '',
          webhook_url: s.webhook_url || '',
        });
        if (ws?.id) {
          const wsFull = await api.getWorkspace(ws.id).then((r) => r.workspace).catch(() => null);
          if (wsFull) {
            setDigest({
              enabled: Boolean(wsFull.digest_enabled),
              email: wsFull.digest_email || '',
            });
          }
          const prefsRes = await api.getDigestPrefs().catch(() => null);
          if (prefsRes?.prefs) setDigestPrefs(prefsRes.prefs);
        }
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
        webhook_url: form.webhook_url,
      });
      const [s, h] = await Promise.all([api.getSettings(), api.health()]);
      setSettings(s);
      setHealth(providerHealth(s, h));
      setForm((current) => ({ ...current, youcom_api_key: '' }));
      setRevealed({});
      toast({ type: 'success', title: 'Settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({ type: 'error', title: 'Not supported', message: 'This browser does not support push notifications.' });
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      toast({ type: 'error', title: 'Permission denied', message: 'Allow notifications in your browser to continue.' });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { key } = await api.vapidKey();
      const types = [];
      if (notifPrefs.any) types.push('any');
      if (notifPrefs.highImpact) types.push('high-impact');
      if (notifPrefs.newCompetitor) types.push('new-competitor');
      if (notifPrefs.digest) types.push('digest');

      // Reuse or replace any existing subscription (a stale one with a different
      // VAPID key causes "push service error" on re-subscribe).
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await api.pushSubscribe(sub.toJSON(), types.length ? types : ['any']);
      toast({ type: 'success', title: 'Browser notifications enabled' });
    } catch (err) {
      const msg = String(err?.message || err);
      // Brave disables Google's push service (FCM) by default → "push service error".
      if (/push service error|AbortError|Registration failed/i.test(msg) && navigator.brave) {
        toast({
          type: 'error',
          title: 'Brave is blocking push',
          message: 'Enable brave://settings/privacy → "Use Google services for push messaging", then restart Brave.',
          duration: 10000,
        });
      } else {
        toast({ type: 'error', title: 'Could not enable', message: msg });
      }
    }
  };

  if (!settings || !health) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-72" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'advanced', label: 'Advanced', icon: 'shield' },
  ];

  return (
    <PageShell width="max-w-2xl">
      <PageHeader title="Settings" description="Manage your workspace and notifications." />

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* GENERAL */}
      {tab === 'general' && (
        <div className="space-y-5">
          <section className="card space-y-3 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Workspace</h2>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-sm font-bold uppercase text-accent-soft">
                {(workspace?.name || 'W')[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{workspace?.name || 'My Workspace'}</p>
                <p className="text-xs capitalize text-slate-500">
                  Plan · {workspace?.plan || 'free'}
                </p>
              </div>
            </div>
          </section>

          {settings.auto_refresh_enabled !== undefined && (
            <section className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-400">Auto-refresh (every 24h)</span>
                <span className={`chip ${settings.auto_refresh_enabled
                  ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-ink-700 bg-ink-850 text-slate-400'}`}>
                  {settings.auto_refresh_enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ADVANCED */}
      {tab === 'advanced' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">Advanced configuration</h2>
            <p className="mt-1 text-sm text-slate-500">Provider credentials, data connection details, and webhook delivery.</p>
          </div>

          <section className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Data connection</h2>
              <span className="chip border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
                <Icon name="check" className="h-3 w-3" /> connected
              </span>
            </div>
            <p className="text-xs text-slate-500">
              The application database is reachable and ready for workspace data.
            </p>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Change alert webhook</h2>
            <p className="text-sm text-slate-400">
              Send detected change summaries to a Slack or Discord webhook.
            </p>
            <div>
              <label htmlFor="settings-webhook-url" className="label">Webhook URL</label>
              <input
                id="settings-webhook-url"
                className="input font-mono text-xs"
                placeholder="https://hooks.slack.com/services/…"
                value={form.webhook_url}
                onChange={set('webhook_url')}
              />
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Research provider</h2>
              <StatusBadge ok={health.youcom_key} />
            </div>
            <p className="text-xs text-slate-500">You.com powers competitor discovery and source retrieval.</p>
            <SecretInput label="YOUCOM_API_KEY" value={form.youcom_api_key} onChange={set('youcom_api_key')}
              revealed={revealed.youcom_api_key} onToggle={() => toggleReveal('youcom_api_key')}
              placeholder={settings?.youcom_key_set ? 'Configured: enter a new key to replace' : 'ydc-…'} />
          </section>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" />} Save advanced settings
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="space-y-5">
          <section className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Browser notifications</h2>
            <p className="text-sm text-slate-400">Get notified instantly in your browser when changes are detected.</p>

            <div className="space-y-2">
              {[
                { key: 'any', label: 'Any pricing change', desc: 'Every detected change' },
                { key: 'highImpact', label: 'High-impact only', desc: 'Only AI-rated high-impact changes' },
                { key: 'newCompetitor', label: 'New competitor discovered', desc: 'When discovery finds a new competitor' },
                { key: 'digest', label: 'Weekly digest', desc: 'Sunday summary of the week' },
              ].map((opt) => (
                <label key={opt.key} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-850 p-3 cursor-pointer hover:border-ink-600 transition">
                  <input
                    type="checkbox"
                    checked={notifPrefs[opt.key]}
                    onChange={(e) => setNotifPrefs((p) => ({ ...p, [opt.key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <button onClick={enablePush} className="btn-primary w-full">
              <Icon name="bell" className="h-4 w-4" /> Enable browser notifications
            </button>
            <p className="text-xs text-slate-600 text-center">
              You'll be asked to grant notification permission.
            </p>
          </section>

          {/* Weekly email digest */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Weekly email digest</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={digest.enabled}
                  onChange={(e) => setDigest((d) => ({ ...d, enabled: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className="text-xs text-slate-400">{digest.enabled ? 'On' : 'Off'}</span>
              </label>
            </div>
            <p className="text-sm text-slate-400">
              A summary of the past week's competitor changes, emailed every Sunday.
            </p>
            <div>
              <label htmlFor="digest-email" className="label">Send to</label>
              <input
                id="digest-email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={digest.email}
                onChange={(e) => setDigest((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-850 p-3 text-xs text-slate-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={digestPrefs.onlySignificant !== false}
                  onChange={(e) => setDigestPrefs((p) => ({ ...p, onlySignificant: e.target.checked }))}
                  className="accent-indigo-500"
                />
                Only significant (medium/high) pricing changes when available
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={digestPrefs.includeDistribution !== false}
                  onChange={(e) => setDigestPrefs((p) => ({ ...p, includeDistribution: e.target.checked }))}
                  className="accent-indigo-500"
                />
                Include market distribution pulse
              </label>
              <label className="flex items-center gap-2">
                Top actions to include
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input w-16 py-1"
                  value={digestPrefs.topActions ?? 3}
                  onChange={(e) => setDigestPrefs((p) => ({ ...p, topActions: Number(e.target.value) || 3 }))}
                />
              </label>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={sendTestDigest} disabled={!digest.email} className="btn-ghost px-3 py-1.5 text-xs">
                Send test
              </button>
              <button onClick={saveDigest} disabled={savingDigest} className="btn-primary w-full sm:w-auto">
                {savingDigest ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />} Save digest
              </button>
            </div>
          </section>
        </div>
      )}

    </PageShell>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
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
  const inputId = useId();
  return (
    <div>
      <label htmlFor={inputId} className="label">{label}</label>
      <div className="relative">
        <input
          id={inputId}
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
          aria-label={`${revealed ? 'Hide' : 'Show'} ${label}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <Icon name={revealed ? 'eye-off' : 'eye'} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
