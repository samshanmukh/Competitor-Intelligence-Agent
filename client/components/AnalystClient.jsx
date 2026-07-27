'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { hasFeature } from '../lib/entitlements';
import { Icon } from './ui';
import SimpleMarkdown from './SimpleMarkdown';
import Link from 'next/link';

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-0.5" aria-label="Thinking" role="status">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-400"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}

function ReasoningBody({ entries, live }) {
  return (
    <div className="max-h-44 space-y-2 overflow-y-auto border-t border-white/5 px-2.5 py-2">
      {entries.map(([agent, text]) => (
        <div key={agent}>
          {entries.length > 1 && (
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {agent}
            </p>
          )}
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-500">
            {text}
            {live ? <span className="inline-block w-1.5 animate-pulse bg-slate-500">|</span> : null}
          </pre>
        </div>
      ))}
    </div>
  );
}

function ReasoningBlock({ parts, open, onToggle, live }) {
  const entries = Object.entries(parts || {}).filter(([, text]) => text?.trim());
  if (!entries.length) return null;

  const title = entries.length === 1
    ? `${entries[0][0]} reasoning`
    : 'Agent reasoning';

  // Finished messages: native details (collapsible). Live stream: controlled toggle.
  if (!live && open === undefined) {
    return (
      <details className="mb-2 rounded-lg border border-white/5 bg-black/20" open>
        <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
          {title}
        </summary>
        <ReasoningBody entries={entries} />
      </details>
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-white/5 bg-black/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500"
      >
        <span>{title}</span>
        <span className="text-slate-600">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <ReasoningBody entries={entries} live={live} />}
    </div>
  );
}

const STARTERS = [
  'What changed with my competitors this week?',
  'Compare entry prices across my rivals',
  'Where am I exposed on positioning?',
  'Who looks overpriced vs best value?',
];

function statusMeta(agent) {
  // Green = Band.ai process heartbeating (Mira/Pricing/Watch/…).
  if (agent.bandOnline) return { label: 'Online', detail: 'Band' };
  if (agent.status === 'needs_key') return { label: 'Needs key', detail: 'Add XAI key in Settings' };
  return { label: 'Offline', detail: 'Start Band agent' };
}

function AgentRoster({ agents }) {
  if (!agents?.length) return null;
  return (
    <div className="mb-4 shrink-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Agents
      </p>
      <ul className="flex flex-wrap gap-2">
        {agents.map((a) => {
          const meta = statusMeta(a);
          const online = a.online;
          return (
            <li
              key={a.id}
              className={`flex min-w-[9.5rem] items-center gap-2 rounded-xl border px-2.5 py-2 ${
                online
                  ? 'border-emerald-500/25 bg-emerald-500/[0.07]'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
              title={meta.detail || meta.label}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  online
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                    : a.status === 'needs_key'
                      ? 'bg-amber-400'
                      : 'bg-slate-600'
                }`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-white">{a.name}</span>
                <span className="block truncate text-[10px] text-slate-500">
                  {meta.label}
                  {meta.detail ? ` · ${meta.detail}` : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AnalystClient() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [reasoningParts, setReasoningParts] = useState({});
  const [draft, setDraft] = useState('');
  const [consultedLive, setConsultedLive] = useState([]);
  const [showReasoning, setShowReasoning] = useState(true);
  const [agents, setAgents] = useState([]);
  const [entitlements, setEntitlements] = useState(null);
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const bottomRef = useRef(null);
  const liveRef = useRef({ reasoning: {}, draft: '', consulted: ['Mira'] });
  const allowed = hasFeature(entitlements, 'ask_mira_analyst');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, draft, reasoningParts, statusLabel]);

  useEffect(() => {
    let cancelled = false;
    api.me()
      .then((data) => {
        if (!cancelled) {
          setEntitlements(data?.entitlements || null);
          setEntitlementsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setEntitlementsLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    async function refresh() {
      try {
        const data = await api.analystAgents();
        if (!cancelled) setAgents(Array.isArray(data?.agents) ? data.agents : []);
      } catch {
        if (!cancelled) setAgents([]);
      }
    }
    refresh();
    const t = setInterval(refresh, 12000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [allowed]);

  async function send(text) {
    const content = String(text || '').trim();
    if (!content || loading) return;

    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);
    setStatusLabel('Starting…');
    setReasoningParts({});
    setDraft('');
    setConsultedLive(['Mira']);
    setShowReasoning(true);
    liveRef.current = { reasoning: {}, draft: '', consulted: ['Mira'] };

    try {
      const data = await api.analystChatStream(next, (event, payload) => {
        if (event === 'status') {
          if (payload?.label) setStatusLabel(payload.label);
          if (Array.isArray(payload?.consult)) {
            const labels = ['Mira'];
            if (payload.consult.includes('pricing')) labels.push('Pricing');
            liveRef.current.consulted = labels;
            setConsultedLive(labels);
          }
        } else if (event === 'reasoning' && payload?.delta) {
          const agent = payload.agent || 'Mira';
          liveRef.current.reasoning[agent] = (liveRef.current.reasoning[agent] || '') + payload.delta;
          setReasoningParts({ ...liveRef.current.reasoning });
        } else if (event === 'token' && payload?.delta) {
          liveRef.current.draft += payload.delta;
          setDraft(liveRef.current.draft);
        } else if (event === 'done') {
          if (Array.isArray(payload?.consulted)) {
            liveRef.current.consulted = payload.consulted;
            setConsultedLive(payload.consulted);
          }
        }
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || liveRef.current.draft || '(No reply)',
          consulted: Array.isArray(data.consulted) ? data.consulted : liveRef.current.consulted,
          reasoningParts: { ...liveRef.current.reasoning },
        },
      ]);
    } catch (err) {
      setError(err?.message || 'Chat failed');
    } finally {
      setLoading(false);
      setStatusLabel('');
      setDraft('');
      setReasoningParts({});
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    send(input);
  }

  if (entitlementsLoaded && !allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-soft">Admin only</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Ask Mira analyst</h1>
        <p className="mt-3 text-sm text-slate-400">
          This feature is in development and limited to admin accounts.
        </p>
        <Link href="/app" className="mt-6 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
          Back to Analysis
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col px-4 py-6 md:px-6">
      <header className="mb-4 shrink-0 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-soft">In-app analyst</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ask Mira</h1>
        <p className="text-sm text-slate-400">
          Band agents: Mira, Pricing, Watch, Positioning, Market. Status below is live Band presence;
          this chat can still answer via the API when Band workers are down.
        </p>
        <AgentRoster agents={agents} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900/50">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !loading && (
            <div className="space-y-3 py-6">
              <p className="text-center text-sm text-slate-500">
                Ask about competitors, positioning, or pricing.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-accent/40 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'whitespace-pre-wrap bg-accent text-white'
                    : 'border border-white/10 bg-white/[0.04] text-slate-200'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-soft">
                      Mira
                    </p>
                    {(m.consulted || []).filter((n) => n !== 'Mira').map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
                      >
                        + {name}
                      </span>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' ? (
                  <>
                    <ReasoningBlock parts={m.reasoningParts} />
                    <SimpleMarkdown source={m.content} />
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[90%] space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-soft">
                    Mira
                  </p>
                  {consultedLive.filter((n) => n !== 'Mira').map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-soft"
                    >
                      + {name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ThinkingDots />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={statusLabel}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-slate-400"
                    >
                      {statusLabel || 'Working…'}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <ReasoningBlock
                  parts={reasoningParts}
                  open={showReasoning}
                  onToggle={() => setShowReasoning((v) => !v)}
                  live
                />

                {draft ? (
                  <div className="border-t border-white/5 pt-2 text-sm text-slate-200">
                    <SimpleMarkdown source={draft} />
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />
                  </div>
                ) : null}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="border-t border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-200" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="flex shrink-0 gap-2 border-t border-white/10 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Mira…"
            disabled={loading}
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dim disabled:opacity-50"
          >
            <Icon name="sparkle" className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
