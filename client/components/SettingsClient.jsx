'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace, getCurrentUser, verifyEmailCode, resendCode } from '../lib/auth';
import { Icon, Skeleton, TabBar, useToast } from './ui';

export default function SettingsClient() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [members, setMembers] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({
    youcom_api_key: '', xai_api_key: '', xai_model: '', insforge_base_url: '', webhook_url: '',
  });
  const [revealed, setRevealed] = useState({});
  const [saving, setSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ any: true, highImpact: true, newCompetitor: false, digest: false });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');
  const [user, setUser] = useState(null);
  const [verifyOtp, setVerifyOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [digest, setDigest] = useState({ enabled: false, email: '' });
  const [savingDigest, setSavingDigest] = useState(false);
  const toast = useToast();

  const saveDigest = async () => {
    if (!workspace?.id) return;
    setSavingDigest(true);
    try {
      await api.updateWorkspace(workspace.id, { digest_enabled: digest.enabled, digest_email: digest.email });
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
    getCurrentUser().then((u) => u && setUser(u)).catch(() => {});
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
        if (ws?.id) {
          const { members } = await api.workspaceMembers(ws.id).catch(() => ({ members: [] }));
          setMembers(members || []);
          const wsFull = await api.getWorkspace(ws.id).then((r) => r.workspace).catch(() => null);
          if (wsFull) {
            setDigest({
              enabled: Boolean(wsFull.digest_enabled),
              email: wsFull.digest_email || (await getCurrentUser().then((u) => u?.email).catch(() => '')) || '',
            });
          }
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
        xai_api_key: form.xai_api_key,
        xai_model: form.xai_model,
        webhook_url: form.webhook_url,
      });
      const h = await api.health();
      setHealth(h);
      toast({ type: 'success', title: 'Settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim() || !workspace?.id) return;
    try {
      const { member } = await api.inviteMember(workspace.id, inviteEmail.trim(), inviteRole);
      setMembers((m) => [...m, member]);
      const sentTo = inviteEmail;
      setInviteEmail('');
      toast({ type: 'success', title: 'Invitation sent', message: sentTo });
    } catch (err) {
      toast({ type: 'error', title: 'Invite failed', message: err.message });
    }
  };

  const verifyEmail = async () => {
    if (!user?.email || verifyOtp.length !== 6) return;
    setVerifying(true);
    try {
      await verifyEmailCode({ email: user.email, otp: verifyOtp.trim() });
      setUser((u) => ({ ...u, emailVerified: true }));
      setVerifyOtp('');
      toast({ type: 'success', title: 'Email verified' });
    } catch (err) {
      toast({ type: 'error', title: 'Verification failed', message: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const resendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await resendCode(user.email);
      toast({ type: 'success', title: 'Code sent', message: `Check ${user.email}` });
    } catch (err) {
      toast({ type: 'error', title: 'Could not resend', message: err.message });
    } finally {
      setResending(false);
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
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-72" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'keys', label: 'API Keys', icon: 'shield' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'team', label: 'Team', icon: 'users' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your workspace, API keys, alerts, and team.</p>
      </header>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* GENERAL */}
      {tab === 'general' && (
        <div className="space-y-5">
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Workspace</h2>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent-soft text-sm font-bold uppercase">
                {(workspace?.name || 'W')[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{workspace?.name || 'My Workspace'}</p>
                <p className="text-xs text-slate-500 capitalize">{workspace?.plan || 'free'} plan</p>
              </div>
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Email Verification</h2>
              {user?.emailVerified ? (
                <span className="chip border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
                  <Icon name="check" className="h-3 w-3" /> verified
                </span>
              ) : (
                <span className="chip border-amber-800/60 bg-amber-950/40 text-amber-300">
                  <Icon name="alert" className="h-3 w-3" /> unverified
                </span>
              )}
            </div>
            {user?.emailVerified ? (
              <p className="text-xs text-slate-500">
                <span className="text-slate-300">{user.email}</span> is verified.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Enter the 6-digit code sent to <span className="text-slate-300">{user?.email || 'your email'}</span> to verify your account.
                </p>
                <div className="flex gap-2">
                  <input
                    className="input text-center font-mono tracking-[0.3em] flex-1"
                    value={verifyOtp}
                    onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <button onClick={verifyEmail} disabled={verifying || verifyOtp.length !== 6} className="btn-primary shrink-0">
                    {verifying ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
                    Verify
                  </button>
                </div>
                <button onClick={resendVerification} disabled={resending} className="text-xs text-slate-500 hover:text-slate-300 transition">
                  {resending ? 'Sending…' : "Didn't get a code? Resend"}
                </button>
              </div>
            )}
          </section>

          <section className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Insforge Database</h2>
              <span className="chip border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
                <Icon name="check" className="h-3 w-3" /> connected
              </span>
            </div>
            <p className="text-xs text-slate-500">
              PostgreSQL backend via Insforge SDK.{' '}
              <span className="font-mono text-slate-400">{form.insforge_base_url}</span>
            </p>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Change Alerts (Webhook)</h2>
            <p className="text-sm text-slate-400">
              POST a summary to a webhook when a change is detected. Works with Slack and Discord.
            </p>
            <div>
              <label className="label">Webhook URL</label>
              <input
                className="input font-mono text-xs"
                placeholder="https://hooks.slack.com/services/…"
                value={form.webhook_url}
                onChange={set('webhook_url')}
              />
            </div>
            <div className="flex justify-end">
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" />} Save
              </button>
            </div>
          </section>

          {settings.auto_refresh_enabled !== undefined && (
            <section className="card p-5">
              <div className="flex items-center justify-between text-sm">
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

      {/* API KEYS */}
      {tab === 'keys' && (
        <div className="space-y-5">
          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">You.com API</h2>
              <StatusBadge ok={health.youcom_key} />
            </div>
            <p className="text-xs text-slate-500">Competitor discovery (Research) and pricing fetching (Contents).</p>
            <SecretInput label="YOUCOM_API_KEY" value={form.youcom_api_key} onChange={set('youcom_api_key')}
              revealed={revealed.youcom_api_key} onToggle={() => toggleReveal('youcom_api_key')}
              placeholder={settings?.youcom_key_set ? 'Configured — enter a new key to replace' : 'ydc-…'} />
          </section>

          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">xAI (Grok) API</h2>
              <StatusBadge ok={health.xai_key} />
            </div>
            <p className="text-xs text-slate-500">Extracts competitors and analyzes pricing diffs.</p>
            <SecretInput label="XAI_API_KEY" value={form.xai_api_key} onChange={set('xai_api_key')}
              revealed={revealed.xai_api_key} onToggle={() => toggleReveal('xai_api_key')}
              placeholder={settings?.xai_key_set ? 'Configured — enter a new key to replace' : 'xai-…'} />
            <div>
              <label className="label">XAI_MODEL</label>
              <input className="input font-mono text-xs" value={form.xai_model} onChange={set('xai_model')} placeholder="grok-4" />
              <p className="mt-1 text-xs text-slate-500">Active: <span className="text-slate-300 font-mono">{health.model}</span></p>
            </div>
          </section>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" />} Save keys
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="space-y-5">
          <section className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Browser Push Notifications</h2>
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
              <h2 className="text-sm font-semibold text-white">Weekly Email Digest</h2>
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
              <label className="label">Send to</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={digest.email}
                onChange={(e) => setDigest((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <button onClick={sendTestDigest} disabled={!digest.email} className="btn-ghost py-1.5 px-3 text-xs">
                Send test
              </button>
              <button onClick={saveDigest} disabled={savingDigest} className="btn-primary">
                {savingDigest ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />} Save digest
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TEAM */}
      {tab === 'team' && (
        <div className="space-y-5">
          <section className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Invite Team Member</h2>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className="input w-32"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
              <button onClick={invite} className="btn-primary shrink-0">
                <Icon name="plus" className="h-4 w-4" /> Invite
              </button>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong className="text-slate-400">Admin</strong> — full access including billing & team</p>
              <p><strong className="text-slate-400">Analyst</strong> — manage competitors & run analysis</p>
              <p><strong className="text-slate-400">Viewer</strong> — read-only access to reports</p>
            </div>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Members</h2>
            {members.length === 0 ? (
              <p className="text-sm text-slate-500">Just you so far. Invite teammates above.</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-slate-400">
                      {(m.invited_email || m.user_id || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.invited_email || m.user_id}</p>
                      <p className="text-xs text-slate-500 capitalize">{m.role}</p>
                    </div>
                    {m.invited_email && (
                      <span className="chip border-amber-800/40 bg-amber-950/30 text-amber-400 text-[10px]">pending</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
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
