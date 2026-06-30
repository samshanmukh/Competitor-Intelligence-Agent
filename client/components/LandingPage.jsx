'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './ui';

const EASE = [0.21, 0.47, 0.32, 0.98];

// Solid raised "3D" card: top highlight + contact shadow + ambient shadow,
// with a subtle lift on hover. No translucent border lines.
const RAISED =
  'rounded-2xl bg-ink-850 ring-1 ring-inset ring-white/[0.04] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.4),0_14px_34px_-12px_rgba(0,0,0,0.7)] ' +
  'transition duration-300 hover:-translate-y-1 hover:bg-ink-800 ' +
  'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_12px_rgba(0,0,0,0.45),0_24px_50px_-14px_rgba(0,0,0,0.8)]';

// Recessed inner well for visuals inside a raised card.
const WELL = 'rounded-xl bg-ink-950/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]';

// Scroll-reveal wrapper.
function Reveal({ children, delay = 0, y = 24, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Inline email capture -> POST /api/waitlist (same-origin route handler, so it
// works in dev and on Vercel with no Express backend).
function WaitlistForm({ size = 'lg', source = 'landing' }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    setMessage('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
      setState('done');
      setMessage(data?.already ? "You're already on the list. We'll be in touch." : "You're on the list. We'll email you when it's your turn.");
    } catch (err) {
      setState('error');
      setMessage(err?.message || 'Something went wrong. Please try again.');
    }
  }

  if (state === 'done') {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3.5 text-sm text-emerald-300">
        <Icon name="check" className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  const big = size === 'lg';
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-2.5 rounded-2xl sm:flex-row sm:gap-2 sm:rounded-full sm:border sm:border-white/10 sm:bg-white/5 sm:p-1.5 sm:backdrop-blur">
        <input
          type="email"
          required
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={`flex-1 rounded-full border border-white/10 bg-white/5 text-white placeholder-slate-500 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/50 sm:border-transparent sm:bg-transparent ${big ? 'px-5 py-3 text-base' : 'px-4 py-2.5 text-sm'}`}
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className={`group inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-accent font-semibold text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] transition hover:bg-accent-dim disabled:opacity-60 ${big ? 'px-6 py-3 text-base' : 'px-5 py-2.5 text-sm'}`}
        >
          {state === 'loading' ? 'Joining…' : <>Join waitlist <Icon name="chevronRight" className="h-4 w-4 transition group-hover:translate-x-0.5" /></>}
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-center text-xs text-rose-400">{message}</p>}
      {state !== 'error' && <p className="mt-3 text-center text-xs text-slate-500">Free in early access. No credit card required.</p>}
    </form>
  );
}

// ---- Custom data-viz mockups (hand-drawn SVG, no chart lib needed) ----

function GrowthMock() {
  // Rising area chart for the "market growth" tile.
  const pts = [6, 10, 9, 14, 18, 22, 28, 34, 40, 52];
  const w = 220, h = 70;
  const max = 56;
  const step = w / (pts.length - 1);
  const line = pts.map((p, i) => `${i * step},${h - (p / max) * h}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="grow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#grow)" />
      <polyline points={line} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - (pts[pts.length - 1] / max) * h} r="3.5" fill="#a5b4fc" />
    </svg>
  );
}

function PositioningMock() {
  // Scatter of competitors on price-vs-value, with "you" highlighted.
  const dots = [
    { x: 22, y: 60, r: 5 }, { x: 40, y: 38, r: 6 }, { x: 58, y: 70, r: 5 },
    { x: 70, y: 30, r: 7 }, { x: 86, y: 52, r: 5 }, { x: 50, y: 20, r: 5 },
  ];
  return (
    <svg viewBox="0 0 120 84" aria-hidden="true" className="h-full w-full">
      <line x1="10" y1="74" x2="114" y2="74" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="10" y1="6" x2="10" y2="74" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="rgba(148,163,184,0.45)" />
      ))}
      <circle cx="34" cy="26" r="7" fill="#6366f1" />
      <circle cx="34" cy="26" r="11" fill="none" stroke="#818cf8" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    setAuthed(Boolean(typeof window !== 'undefined' && localStorage.getItem('cia_token')));
  }, []);
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950 text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-ink-950/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">Mira AI</Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#why" className="transition hover:text-white">Why Mira</a>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Link href="/app" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200">Go to app</Link>
            ) : (
              <button type="button" onClick={() => setModalOpen(true)} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200">Join waitlist</button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Background: animated aurora + spotlight + grid */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          {/* Soft spotlight directly behind the headline */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 50% 40% at 50% 12%, rgba(99,102,241,0.12), transparent 62%)',
            }}
          />
          {/* Drifting aurora blobs */}
          <motion.div
            className="absolute left-[18%] top-[-6%] h-[420px] w-[420px] rounded-full bg-accent/25 blur-[130px]"
            animate={{ x: [0, 60, 0], y: [0, 30, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-[14%] top-[8%] h-[360px] w-[360px] rounded-full bg-violet-600/22 blur-[130px]"
            animate={{ x: [0, -50, 0], y: [0, 40, 0], scale: [1.1, 1, 1.1] }}
            transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-[18%] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-sky-500/15 blur-[120px]"
            animate={{ y: [0, -24, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Conic glow ring */}
          <div
            className="absolute left-1/2 top-[-30%] h-[700px] w-[700px] -translate-x-1/2 opacity-40"
            style={{
              background:
                'conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(129,140,248,0.12) 90deg, transparent 180deg, rgba(167,139,250,0.12) 270deg, transparent 360deg)',
              maskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
            }}
          />
          {/* Grid of cells (graph-paper) — subtle but visible behind the headline */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse 85% 75% at 50% 16%, black 45%, transparent 82%)',
              WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 16%, black 45%, transparent 82%)',
            }}
          />
          {/* A few softly highlighted cells for life */}
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(129,140,248,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(129,140,248,0.10) 1px, transparent 1px)',
              backgroundSize: '176px 176px',
              maskImage: 'radial-gradient(ellipse 60% 55% at 50% 14%, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 14%, black 30%, transparent 75%)',
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl px-5 pt-20 pb-14 text-center md:pt-28">
          <motion.a
            href="#why"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur transition hover:border-white/20"
          >
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            AI market & competitive intelligence
            <Icon name="chevronRight" className="h-3 w-3 text-slate-500" />
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06, ease: EASE }}
            className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            Know your{' '}
            <span className="bg-gradient-to-r from-accent-soft via-indigo-300 to-violet-300 bg-clip-text text-transparent">market</span>
            <br className="hidden sm:block" /> in minutes, not weeks
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
            className="mx-auto mt-6 max-w-xl text-lg text-slate-400"
          >
            Add your product. Mira AI maps your market, tracks competitors, and tells you exactly how to win.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
            className="mt-9"
            id="waitlist"
          >
            {authed ? (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/app" className="inline-flex items-center gap-1.5 rounded-full bg-accent px-6 py-3 text-base font-semibold text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] transition hover:bg-accent-dim">
                  <Icon name="sparkle" className="h-4 w-4" /> Go to app
                </Link>
                <a href="#how" className="rounded-full border border-white/10 px-6 py-3 text-base font-medium text-slate-200 transition hover:bg-white/5">See how it works</a>
              </div>
            ) : (
              <WaitlistForm size="lg" source="hero" />
            )}
          </motion.div>
        </div>

        {/* Product preview */}
        <div className="mx-auto max-w-5xl px-5 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
            className="relative"
          >
            <div className="absolute -inset-x-10 -top-8 bottom-0 -z-10 rounded-[40px] bg-accent/10 blur-3xl" />
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
              <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-3 text-xs text-slate-500">Mira AI · Competitive report · Acme Analytics</span>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                {/* Market growth tile */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Market size</p>
                    <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">+18% CAGR</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">$4.2B</p>
                  <div className="mt-2 h-[60px]"><GrowthMock /></div>
                </div>
                {/* Positioning tile */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left">
                  <p className="text-xs text-slate-500">Positioning map</p>
                  <div className="mt-2 h-[88px]"><PositioningMock /></div>
                  <p className="mt-1 text-xs text-accent-soft">You: best value quadrant</p>
                </div>
                {/* KPI stack */}
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Competitors found', value: '8', icon: 'users' },
                    { label: 'Avg. value score', value: '7.2/10', icon: 'trending' },
                    { label: 'Review sentiment', value: 'Mixed', icon: 'activity' },
                  ].map((k) => (
                    <div key={k.label} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent-soft">
                        <Icon name={k.icon} className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-base font-semibold leading-none text-white">{k.value}</p>
                        <p className="mt-1 text-xs text-slate-500">{k.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 pb-5">
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">Analyst take</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                    "Two rivals anchor the premium tier at $99/mo while the mid-market sits underserved.
                    You can win on price-to-value. Test a $39 Pro plan and lead with integrations."
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-5 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-8 text-center">
              <p className="bg-gradient-to-br from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{s.value}</p>
              <p className="mt-1.5 text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent-soft">Capabilities</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">Everything you need to out-position rivals</h2>
          <p className="mt-4 text-slate-400">One agent replaces hours of research, spreadsheets and guesswork.</p>
        </Reveal>

        {/* Spotlight differentiators */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {SPOTLIGHT.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className={`group h-full overflow-hidden p-6 ${RAISED}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent-soft ring-1 ring-accent/20">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                <div className={`mt-5 h-[84px] p-3 ${WELL}`}>{f.visual}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Compact feature grid */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06}>
              <div className={`group h-full p-5 ${RAISED}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-accent-soft transition group-hover:bg-accent/15">
                  <Icon name={f.icon} className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent-soft">How it works</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">Full report in three steps</h2>
            <p className="mt-4 text-slate-400">No setup. Just answers.</p>
          </Reveal>
          <div className="relative mt-14 grid gap-8 md:grid-cols-3">
            <div className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1} className="relative text-center md:text-left">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-sm font-bold text-white shadow-[0_6px_18px_-4px_rgba(99,102,241,0.7)] md:mx-0">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why Mira — outcomes + personas */}
      <section id="why" className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-widest text-accent-soft">Why Mira</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">Turn market noise into clear strategy</h2>
            <p className="mt-4 text-slate-400">
              Most teams rely on scattered research and spreadsheets that go stale fast. Mira AI sizes your market,
              tracks competitors, and turns the signals into clear moves, so you act on evidence and never get blindsided.
            </p>
            <ul className="mt-7 space-y-3.5">
              {OUTCOMES.map((o) => (
                <li key={o} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                  {o}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="grid gap-4 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <div key={p.title} className={`p-5 ${RAISED}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent-soft">
                  <Icon name={p.icon} className="h-4 w-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{p.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-24">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-accent/15 to-ink-900 px-6 py-20 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-accent/25 blur-[120px]" />
          <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Limited early-access spots</span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">Be first in line</h2>
          <p className="mx-auto mt-4 max-w-md text-slate-400">Join the waitlist. We'll email your invite the moment it's ready.</p>
          <div className="mt-9">
            {authed ? (
              <Link href="/app" className="inline-flex items-center gap-1.5 rounded-full bg-accent px-7 py-3 text-base font-semibold text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)] transition hover:bg-accent-dim">
                <Icon name="sparkle" className="h-4 w-4" /> Go to app
              </Link>
            ) : (
              <WaitlistForm size="lg" source="footer-cta" />
            )}
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <span className="text-base font-semibold tracking-tight text-slate-200">Mira AI</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="transition hover:text-slate-300">Features</a>
            <a href="#how" className="transition hover:text-slate-300">How it works</a>
            <a href="#why" className="transition hover:text-slate-300">Why Mira</a>
          </div>
          <span className="text-xs text-slate-600">© {new Date().getFullYear()} Mira AI</span>
        </div>
      </footer>

      {/* Waitlist modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-7 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
            <h3 className="text-xl font-semibold text-white">Join the waitlist</h3>
            <p className="mt-2 text-sm text-slate-400">Enter your email and we'll send your early-access invite to Mira AI when it's ready.</p>
            <div className="mt-6">
              <WaitlistForm size="sm" source="header-modal" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

const STATS = [
  { value: '~40s', label: 'To find your competitors' },
  { value: '11+', label: 'Signals per report' },
  { value: '5-yr', label: 'Market growth timeline' },
  { value: '1 click', label: 'Full competitive report' },
];

const SPOTLIGHT = [
  {
    icon: 'activity',
    title: 'Market intelligence',
    desc: 'Real market value, growth, and competitor funding and revenue from live finance research.',
    visual: <GrowthMock />,
  },
  {
    icon: 'bar',
    title: 'Positioning map',
    desc: 'See who is best-value, premium or overpriced on price-vs-value, with you plotted in.',
    visual: <PositioningMock />,
  },
  {
    icon: 'sparkle',
    title: 'AI analyst take',
    desc: 'A candid read on where you win, where you are exposed, and what to do next.',
    visual: (
      <p className="text-xs italic leading-relaxed text-slate-400">"Win on price-to-value. Test a $39 Pro plan and lead with integrations."</p>
    ),
  },
];

const FEATURES = [
  { icon: 'search', title: 'Competitor discovery', desc: 'Paste a URL and Mira finds your closest competitors, or add your own.' },
  { icon: 'eye', title: 'Company deep dive', desc: 'A full dossier: overview, financials, web traffic and reviews.' },
  { icon: 'card', title: 'Pricing comparison', desc: 'Every competitor’s tiers and prices, side by side with charts.' },
  { icon: 'grid', title: 'Feature matrix', desc: 'Which features each competitor offers across tiers, in one grid.' },
  { icon: 'trending', title: 'Value scoring', desc: 'AI scores each competitor on value for money and explains why.' },
  { icon: 'users', title: 'Voice of the customer', desc: 'Real reviews from G2, Capterra and Trustpilot: ratings and sentiment.' },
  { icon: 'shield', title: 'SWOT & strategy', desc: 'Strengths, weaknesses, opportunities and threats, with moves to win.' },
  { icon: 'bell', title: 'Change alerts', desc: 'Browser, webhook and Slack alerts when a competitor changes anything.' },
];

const STEPS = [
  { title: 'Add your product', desc: 'Enter your name and URL. Mira reads your site to learn your market.' },
  { title: 'Find competitors', desc: 'Mira finds your closest competitors. Confirm who to track.' },
  { title: 'Get your report', desc: 'One click: market size, competitors, pricing, value and reviews.' },
];

const OUTCOMES = [
  'Size your market and track its growth and momentum',
  'Spot underserved gaps and where you can win',
  'Benchmark competitors on features, value and pricing',
  'Get alerted when a competitor changes anything',
];

const PERSONAS = [
  { icon: 'sparkle', title: 'Founders', desc: 'Know your market and price with confidence.' },
  { icon: 'trending', title: 'Product & pricing', desc: 'Back decisions with live market data.' },
  { icon: 'shield', title: 'Sales teams', desc: 'Win deals with current battlecards.' },
  { icon: 'users', title: 'Strategy & research', desc: 'A live view of the whole market.' },
];
