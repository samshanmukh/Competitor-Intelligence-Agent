'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from './ui';
import BrandLogo from './BrandLogo';
import { AUTHOR } from '../lib/geoContent';
import LandingPositioningDemo from './LandingPositioningDemo';

const EASE = [0.21, 0.47, 0.32, 0.98];

// Frosted glass card with lift on hover.
const RAISED =
  'rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_40px_-16px_rgba(0,0,0,0.65)] ' +
  'transition duration-300 hover:-translate-y-1 hover:bg-white/[0.08] hover:border-white/15 ' +
  'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_24px_50px_-14px_rgba(0,0,0,0.75)]';

// Scroll-reveal wrapper. Never SSR opacity:0, GEO crawlers treat that as empty text.
function Reveal({ children, delay = 0, y = 24, className = '' }) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const animate = mounted && !reduceMotion;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y } : false}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: '-80px' }}
      transition={animate ? { duration: 0.6, delay, ease: EASE } : undefined}
      className={className}
    >
      {children}
    </motion.div>
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
  const reduceMotion = useReducedMotion();
  // Never SSR opacity:0 on hero copy, crawlers treat it as empty text.
  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    setHeroReady(true);
  }, []);
  const heroAnimate = heroReady && !reduceMotion;
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950 text-slate-200">
      {/* Nav */}
      <header className="glass-nav sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <BrandLogo href="/" height={32} priority />
          <Link href="/app" className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200">Go to app</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Background: animated aurora + spotlight + grid */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          {/* Drifting aurora blobs */}
          <motion.div
            className="absolute left-[18%] top-[-6%] h-[420px] w-[420px] rounded-full bg-accent/25 blur-[130px]"
            animate={reduceMotion ? undefined : { x: [0, 60, 0], y: [0, 30, 0], scale: [1, 1.12, 1] }}
            transition={reduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-[14%] top-[8%] h-[360px] w-[360px] rounded-full bg-violet-600/22 blur-[130px]"
            animate={reduceMotion ? undefined : { x: [0, -50, 0], y: [0, 40, 0], scale: [1.1, 1, 1.1] }}
            transition={reduceMotion ? undefined : { duration: 19, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-[18%] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-sky-500/15 blur-[120px]"
            animate={reduceMotion ? undefined : { y: [0, -24, 0], scale: [1, 1.08, 1] }}
            transition={reduceMotion ? undefined : { duration: 13, repeat: Infinity, ease: 'easeInOut' }}
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
          {/* Grid of cells (graph-paper), subtle but visible behind the headline */}
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
            initial={heroAnimate ? { opacity: 0, y: 10 } : false}
            animate={heroAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={heroAnimate ? { duration: 0.5, ease: EASE } : undefined}
            className="inline-block text-xs font-medium uppercase tracking-[0.16em] text-slate-400 transition hover:text-slate-200"
          >
            Built around your business
          </motion.a>

          <motion.h1
            initial={heroAnimate ? { opacity: 0, y: 18 } : false}
            animate={heroAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={heroAnimate ? { duration: 0.6, delay: 0.06, ease: EASE } : undefined}
            className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            <span className="bg-gradient-to-r from-accent-soft via-indigo-300 to-violet-300 bg-clip-text text-transparent">Competitive and market intelligence</span>
            <br className="hidden sm:block" /> for founders
          </motion.h1>

          <motion.p
            initial={heroAnimate ? { opacity: 0, y: 18 } : false}
            animate={heroAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={heroAnimate ? { duration: 0.6, delay: 0.12, ease: EASE } : undefined}
            className="mx-auto mt-6 max-w-xl text-lg text-slate-400"
          >
            Turn competitor and market signals into clear next moves, so you know where you stand and what to focus on.
          </motion.p>

          <motion.div
            initial={heroAnimate ? { opacity: 0, y: 18 } : false}
            animate={heroAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={heroAnimate ? { duration: 0.6, delay: 0.18, ease: EASE } : undefined}
            className="mx-auto mt-9 max-w-3xl"
            id="get-started"
          >
            <LandingPositioningDemo />
            <p className="mt-4 text-center text-sm text-slate-500">
              Or <Link href="/app" className="text-slate-300 underline-offset-2 hover:text-white hover:underline">open the full app</Link>
            </p>
          </motion.div>
        </div>

        {/* Product preview */}
        <div className="mx-auto max-w-5xl px-5 pb-20">
          <motion.div
            initial={heroAnimate ? { opacity: 0, y: 40 } : false}
            animate={heroAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={heroAnimate ? { duration: 0.8, delay: 0.24, ease: EASE } : undefined}
            className="relative"
          >
            <div className="absolute -inset-x-10 -top-8 bottom-0 -z-10 rounded-[40px] bg-accent/10 blur-3xl" />
            <div className="glass-strong overflow-hidden rounded-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
              <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-3 text-xs text-slate-500">Mira · Business report · Acme Analytics</span>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                {/* Market growth tile */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Market size</p>
                    <span className="text-xs font-medium tabular-nums text-slate-400">+18% CAGR</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">$4.2B</p>
                  <div className="mt-2 h-[60px]"><GrowthMock /></div>
                </div>
                {/* Positioning tile */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left">
                  <p className="text-xs text-slate-500">Where you stand</p>
                  <div className="mt-2 h-[88px]"><PositioningMock /></div>
                  <p className="mt-1 text-xs text-accent-soft">You: best-value quadrant</p>
                </div>
                {/* Business summary stack */}
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Ideal customer', value: 'Ops teams', icon: 'users' },
                    { label: 'Business model', value: 'Subscription', icon: 'card' },
                    { label: 'Stage', value: 'Early / seed', icon: 'activity' },
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
                    "You're a mid-market analytics tool in a $4.2B market growing 18%. Your edge is time-to-value.
                    Focus next on owning the ops-team customer and a self-serve $39 tier."
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

      {/* Capabilities, three short points, easy to scan */}
      <section id="features" className="mx-auto max-w-5xl px-5 py-24">
        <Reveal className="mx-auto max-w-xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent-soft">Capabilities</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">What you get</h2>
          <p className="mt-3 text-slate-400">A clear read on your business, market, and next moves.</p>
        </Reveal>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {CAPABILITIES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08} className="text-center md:text-left">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-soft ring-1 ring-accent/20 md:mx-0">
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{f.desc}</p>
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
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-sm font-semibold text-white md:mx-0">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why Mira, outcomes + personas */}
      <section id="why" className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-widest text-accent-soft">Why Mira</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">Get clarity before you scale</h2>
            <p className="mt-4 text-slate-400">
              Most founders are too deep in the build to see their own business clearly. Mira reads your site,
              researches your market, and reflects the whole picture back, so you know what you're building and what to
              focus on next.
            </p>
            <ul className="mt-7 space-y-3.5">
              {OUTCOMES.map((o) => (
                <li key={o} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300">
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
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Open to everyone</p>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">See your market clearly</h2>
          <p className="mx-auto mt-4 max-w-md text-slate-400">Start turning market signals into focused next moves.</p>
          <div className="mt-9">
            <Link href="/app" className="group inline-flex items-center gap-1.5 rounded-md bg-accent px-7 py-3 text-base font-semibold text-white transition hover:bg-accent-dim">
              Go to app <Icon name="chevronRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer, NAP/contact + About/Team/FAQ links for GEO authority signals */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-slate-500">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <BrandLogo href="/" height={28} />
            <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500 sm:text-left">
              Competitive intelligence for founders ·{' '}
              <a href="mailto:support@joinmira.ai" className="text-slate-400 underline-offset-2 hover:underline">
                support@joinmira.ai
              </a>
            </p>
            <span className="text-xs text-slate-600">© {new Date().getFullYear()} Mira</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#features" className="transition hover:text-slate-300">Features</a>
            <a href="#how" className="transition hover:text-slate-300">How it works</a>
            <Link href="/guide" className="transition hover:text-slate-300">Product guide</Link>
            <Link href="/competitive-intelligence-software" className="transition hover:text-slate-300">CI software</Link>
            <Link href="/competitor-pricing-analysis" className="transition hover:text-slate-300">Pricing analysis</Link>
            <Link href="/tam-sam-som" className="transition hover:text-slate-300">TAM/SAM/SOM</Link>
            <Link href="/find-saas-competitors" className="transition hover:text-slate-300">Find competitors</Link>
            <Link href="/faq" className="transition hover:text-slate-300">FAQ</Link>
            <Link href="/about" className="transition hover:text-slate-300">About</Link>
            <Link href="/team" className="transition hover:text-slate-300">Team</Link>
            <Link href="/contact" className="transition hover:text-slate-300">Contact</Link>
            <Link href="/methodology" className="transition hover:text-slate-300">Methodology</Link>
            <Link href="/privacy" className="transition hover:text-slate-300">Privacy</Link>
            <Link href="/terms" className="transition hover:text-slate-300">Terms</Link>
            <a href="mailto:support@joinmira.ai" className="transition hover:text-slate-300">support@joinmira.ai</a>
            <Link href="/app" className="transition hover:text-slate-300">Open app</Link>
            <a href={AUTHOR.linkedin} target="_blank" rel="noreferrer" className="transition hover:text-slate-300">
              Built by {AUTHOR.name}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const STATS = [
  { value: '~2 min', label: 'From URL to clarity report' },
  { value: 'Market', label: 'Sized with live research' },
  { value: 'Rivals', label: 'Named competitors with pricing' },
  { value: 'Weekly', label: 'Refresh to stay current' },
];

const CAPABILITIES = [
  { icon: 'eye', title: 'Your business, clearly', desc: 'What you do, who you serve, and how you make money.' },
  { icon: 'activity', title: 'Market & timing', desc: 'Market size, growth, and why now.' },
  { icon: 'sparkle', title: 'Your next moves', desc: 'Strengths, gaps, and what to focus on.' },
];

const STEPS = [
  { title: 'Paste your URL', desc: 'Mira reads your site to understand what you are building.' },
  { title: 'Get your clarity report', desc: 'Your business, customer, market and where you stand.' },
  { title: 'Know your next move', desc: 'Prioritized focus areas, positioning and pricing.' },
];

const OUTCOMES = [
  'See your business the way an analyst would',
  'Nail your ideal customer and positioning',
  'Size your market and understand the timing',
  'Know the top moves to focus on next',
];

const PERSONAS = [
  { icon: 'sparkle', title: 'Solo founders', desc: 'An analyst’s view without hiring one.' },
  { icon: 'trending', title: 'Pre-seed & seed', desc: 'Sharpen your story before you raise.' },
  { icon: 'zap', title: 'Indie hackers', desc: 'Validate and position what you built.' },
  { icon: 'users', title: 'Accelerator teams', desc: 'Get clarity fast, in a weekend.' },
];
