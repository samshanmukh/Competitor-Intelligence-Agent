'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './ui';

const EASE = [0.21, 0.47, 0.32, 0.98];

const PRIORITY = {
  high: { dot: 'text-rose-400', label: 'High' },
  medium: { dot: 'text-amber-400', label: 'Medium' },
  low: { dot: 'text-sky-400', label: 'Low' },
};

// Status → display group. New submissions default to 'open' → Backlog.
const GROUPS = [
  { key: 'planned', label: 'Planned', icon: 'clock', tone: 'text-slate-300', statuses: ['planned', 'in_progress'] },
  { key: 'backlog', label: 'Backlog', icon: 'list', tone: 'text-amber-400', statuses: ['open', 'backlog', 'under_review'] },
  { key: 'completed', label: 'Completed', icon: 'check', tone: 'text-accent-soft', statuses: ['completed', 'done', 'shipped'] },
];
function groupOf(status) {
  return GROUPS.find((g) => g.statuses.includes(status))?.key || 'backlog';
}

export default function FeatureRequestsClient() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'new' | 'edit', request }

  async function load() {
    try {
      const res = await fetch('/api/feature-requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  async function toggleVote(id) {
    setRequests((rs) => rs.map((r) => r.id === id ? { ...r, voted: !r.voted, votes: r.votes + (r.voted ? -1 : 1) } : r));
    try {
      const res = await fetch('/api/feature-requests/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id }),
      });
      if (!res.ok) throw new Error('vote failed');
    } catch { load(); }
  }

  function onCreated(req) { setRequests((rs) => [{ ...req }, ...rs]); setModal(null); }
  function onSaved(id, patch) { setRequests((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); setModal(null); }
  function onDeleted(id) { setRequests((rs) => rs.filter((r) => r.id !== id)); setModal(null); }

  // Group + sort (by votes desc within each group).
  const grouped = useMemo(() => {
    const byGroup = {};
    for (const r of requests) {
      const g = groupOf(r.status);
      (byGroup[g] ||= []).push(r);
    }
    for (const g of Object.keys(byGroup)) byGroup[g].sort((a, b) => b.votes - a.votes || new Date(b.created_at) - new Date(a.created_at));
    return byGroup;
  }, [requests]);

  const hasAny = requests.length > 0;

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/" style={{ fontFamily: 'var(--font-brand)' }} className="text-lg font-semibold tracking-tight text-white">
            Mira <span className="text-accent-soft">Vue</span>
          </Link>
          <Link href="/" className="text-sm text-slate-400 transition hover:text-white">← Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-28 pt-14">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Feature requests</h1>
        <p className="mt-3 text-lg text-slate-500">Discover our plans and suggest new improvements.</p>

        <div className="mt-10 space-y-8">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}

          {!loading && !hasAny && (
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center text-sm text-slate-400">
              No requests yet. Be the first — hit <span className="text-white">New request</span>.
            </div>
          )}

          {!loading && GROUPS.map((g) => {
            const items = grouped[g.key];
            if (!items?.length) return null;
            return (
              <section key={g.key}>
                <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2.5">
                  <Icon name={g.icon} className={`h-4 w-4 ${g.tone}`} />
                  <span className="text-sm font-semibold text-white">{g.label}</span>
                  <span className="text-xs text-slate-600">{items.length}</span>
                </div>
                <div className="mt-1">
                  {items.map((r, i) => {
                    const p = PRIORITY[r.priority] || PRIORITY.medium;
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.2), ease: EASE }}
                        className="group flex items-center gap-3 rounded-lg px-3 py-3.5 transition hover:bg-white/[0.02]"
                      >
                        <span className={`shrink-0 ${p.dot}`} title={`${p.label} priority`}>
                          <Icon name="zap" className="h-4 w-4" />
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{r.title}</p>

                        {r.mine && (
                          <button
                            onClick={() => setModal({ mode: 'edit', request: r })}
                            aria-label="Edit your request"
                            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/5 hover:text-white group-hover:flex"
                          >
                            <Icon name="settings" className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => toggleVote(r.id)}
                          aria-pressed={r.voted}
                          aria-label={r.voted ? 'Remove your vote' : 'Vote'}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition ${r.voted ? 'border-accent/50 bg-accent/15 text-accent-soft' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white'}`}
                        >
                          <Icon name="chevronUp" className="h-3.5 w-3.5" />
                          {r.votes}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Sticky New request button */}
      <button
        onClick={() => setModal({ mode: 'new' })}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_28px_-6px_rgba(99,102,241,0.7)] transition hover:bg-accent-dim"
      >
        <Icon name="plus" className="h-4 w-4" /> New request
      </button>

      {modal && (
        <RequestModal
          editing={modal.mode === 'edit' ? modal.request : null}
          onClose={() => setModal(null)}
          onCreated={onCreated}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}

function RequestModal({ editing, onClose, onCreated, onSaved, onDeleted }) {
  const isEdit = Boolean(editing);
  const [title, setTitle] = useState(editing?.title || '');
  const [priority, setPriority] = useState(editing?.priority || 'medium');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  const PRIO_CLS = {
    high: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    low: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  };

  async function submit(e) {
    e.preventDefault();
    if (state === 'loading' || title.trim().length < 3) return;
    setState('loading');
    setError('');
    try {
      if (isEdit) {
        const res = await fetch('/api/feature-requests', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, title: title.trim(), priority }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Could not save.');
        onSaved(editing.id, { title: title.trim(), priority });
      } else {
        const res = await fetch('/api/feature-requests', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), priority }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Could not submit.');
        onCreated(data.request);
      }
    } catch (err) {
      setState('idle');
      setError(err.message || 'Something went wrong.');
    }
  }

  async function remove() {
    if (state === 'loading') return;
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not delete.');
      onDeleted(editing.id);
    } catch (err) {
      setState('idle');
      setError(err.message || 'Something went wrong.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200">
          <Icon name="x" className="h-4 w-4" />
        </button>
        <h3 className="text-xl font-semibold text-white">{isEdit ? 'Edit request' : 'New request'}</h3>
        <p className="mt-2 text-sm text-slate-400">{isEdit ? 'Update your request or delete it.' : 'What should we build? Tell us and set a priority.'}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={4}
            autoFocus
            aria-label="Your request"
            placeholder="e.g. Let me export the market model as a shareable link"
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Priority</span>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((pk) => (
                <button
                  key={pk}
                  type="button"
                  onClick={() => setPriority(pk)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition ${priority === pk ? PRIO_CLS[pk] + ' ring-1 ring-inset ring-white/10' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
                >
                  {pk}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={state === 'loading' || title.trim().length < 3}
            className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] transition hover:bg-accent-dim disabled:opacity-50"
          >
            {state === 'loading' ? 'Saving…' : isEdit ? 'Save changes' : 'Submit request'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={remove}
              disabled={state === 'loading'}
              className="w-full rounded-full border border-rose-500/30 bg-rose-950/30 px-5 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-950/50 disabled:opacity-50"
            >
              Delete request
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}
