'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, useToast } from './ui';

/** Avoid clashing with the feature-request FAB on /requests. */
const HIDE_ON = ['/requests'];

export default function SupportButton() {
  const pathname = usePathname();
  const toast = useToast();
  const titleId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ email: '', subject: '', message: '' });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="glass-strong pointer-events-auto w-[min(100vw-2.5rem,22rem)] rounded-2xl p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-white">Help &amp; feedback</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ask a question or tell us what’s not working.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-ink-800 hover:text-slate-200"
              aria-label="Close help"
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
                autoComplete="email"
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
                placeholder="Question, bug, or feedback"
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
                placeholder="How can we help?"
              />
            </div>
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Close help' : 'Help and feedback'}
        title="Help & feedback"
        className="glass pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:border-accent/40 hover:bg-white/[0.08] sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-3"
      >
        <Icon name={open ? 'x' : 'mail'} className="h-4 w-4 text-accent-soft" />
        <span className="hidden text-sm font-semibold sm:inline">{open ? 'Close' : 'Help'}</span>
      </button>
    </div>
  );
}
