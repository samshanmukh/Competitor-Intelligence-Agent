'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getCurrentUser } from '../lib/auth';
import { Icon, useToast } from './ui';

const HIDE_ON = ['/requests'];

export default function SupportButton() {
  const pathname = usePathname();
  const toast = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ email: '', subject: '', message: '' });

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email }));
      })
      .catch(() => {});
  }, []);

  if (HIDE_ON.some((p) => pathname === p || pathname?.startsWith(`${p}/`))) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send message.');
      toast({ type: 'success', title: 'Message sent', message: 'We’ll get back to you at your email.' });
      setForm((f) => ({ ...f, subject: '', message: '' }));
      setOpen(false);
    } catch (err) {
      toast({ type: 'error', title: 'Could not send', message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-[min(100vw-2.5rem,22rem)] rounded-2xl border border-ink-700 bg-ink-900 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-white">Contact support</h2>
              <p className="mt-0.5 text-xs text-slate-500">Sends to support@joinmira.ai</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-ink-800 hover:text-slate-200"
              aria-label="Close support"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="support-email" className="label">Your email</label>
              <input
                id="support-email"
                type="email"
                className="input"
                required
                value={form.email}
                onChange={set('email')}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="support-subject" className="label">Subject</label>
              <input
                id="support-subject"
                type="text"
                className="input"
                required
                minLength={3}
                maxLength={200}
                value={form.subject}
                onChange={set('subject')}
                placeholder="How can we help?"
              />
            </div>
            <div>
              <label htmlFor="support-message" className="label">Message</label>
              <textarea
                id="support-message"
                className="input min-h-[7rem] resize-y"
                required
                minLength={10}
                maxLength={5000}
                value={form.message}
                onChange={set('message')}
                placeholder="Describe the issue or question…"
              />
            </div>
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Sending…' : 'Send to support'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] transition hover:border-ink-600 hover:bg-ink-850"
      >
        <Icon name="mail" className="h-4 w-4 text-accent-soft" />
        <span className="hidden sm:inline">{open ? 'Close' : 'Support'}</span>
        <span className="sm:hidden">{open ? 'Close' : 'Help'}</span>
      </button>
    </div>
  );
}
