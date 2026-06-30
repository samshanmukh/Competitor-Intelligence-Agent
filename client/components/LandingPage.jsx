'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './ui';

// Inline email capture → POST /api/waitlist. `variant` tunes sizing for the
// hero vs. the final CTA. On success it swaps to a confirmation message.
function WaitlistForm({ variant = 'hero', source = 'landing' }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    setMessage('');
    try {
      // Same-origin Next.js route handler → Insforge. Works in dev and on Vercel
      // with no Express backend.
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
      <div className="mx-auto flex max-w-md items-center justify-center gap-2.5 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
        <Icon name="check" className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  const big = variant === 'hero';
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={`flex-1 rounded-xl border border-ink-700 bg-ink-900 text-slate-200 placeholder-slate-600 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20 ${big ? 'px-4 py-3 text-base' : 'px-4 py-2.5 text-sm'}`}
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className={`btn-primary justify-center whitespace-nowrap ${big ? 'px-5 py-3 text-base' : 'px-5 py-2.5 text-sm'} disabled:opacity-60`}
        >
          {state === 'loading' ? 'Joining…' : <><Icon name="sparkle" className="h-4 w-4" /> Join waitlist</>}
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-xs text-rose-400">{message}</p>}
    </form>
  );
}

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    setAuthed(Boolean(typeof window !== 'undefined' && localStorage.getItem('cia_token')));
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-800/60 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
              <Icon name="radar" className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-white">Mira AI</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how" className="hover:text-white transition">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Link href="/app" className="btn-primary py-1.5 px-3 text-sm">Go to app</Link>
            ) : (
              <button type="button" onClick={() => setModalOpen(true)} className="btn-primary py-1.5 px-3 text-sm">Join waitlist</button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10%] h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-4xl px-5 pt-20 pb-16 text-center md:pt-28">
          <span className="chip border-accent/30 bg-accent/10 text-accent-soft">
            <Icon name="sparkle" className="h-3 w-3" /> AI market & competitive intelligence
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl">
            Know your market<br className="hidden sm:block" /> in minutes, not weeks
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Add your product. Mira AI maps your market: its size and growth, your competitors, how you
            compare on features, value and pricing, and what customers say. Plus a clear take on how to win.
          </p>
          <div className="mt-8" id="waitlist">
            {authed ? (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/app" className="btn-primary px-5 py-2.5 text-base">
                  <Icon name="sparkle" className="h-4 w-4" /> Go to app
                </Link>
                <a href="#how" className="btn-ghost px-5 py-2.5 text-base">See how it works</a>
              </div>
            ) : (
              <WaitlistForm variant="hero" source="hero" />
            )}
          </div>
          <p className="mt-4 text-xs text-slate-600">Join the early-access waitlist · No credit card required</p>
        </div>

        {/* Product preview mock */}
        <div className="mx-auto max-w-4xl px-5 pb-16">
          <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-ink-800 bg-ink-850 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-3 text-xs text-slate-500">Competitive report · Acme Analytics</span>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              {[
                { label: 'Competitors found', value: '8', icon: 'users', tone: 'text-accent-soft' },
                { label: 'Avg. value score', value: '7.2/10', icon: 'trending', tone: 'text-emerald-400' },
                { label: 'Review sentiment', value: 'Mixed', icon: 'activity', tone: 'text-amber-400' },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-ink-700 bg-ink-850 p-4 text-left">
                  <Icon name={k.icon} className={`h-4 w-4 ${k.tone}`} />
                  <p className="mt-2 text-2xl font-bold text-white">{k.value}</p>
                  <p className="text-xs text-slate-500">{k.label}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft">Analyst take</p>
                <p className="mt-1.5 text-sm text-slate-300">
                  "Two rivals anchor the premium tier at $99/mo while the mid-market sits underserved.
                  You can win on price-to-value. Test a $39 Pro plan and lead with integrations."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / trust strip */}
      <section className="border-y border-ink-800/60 bg-ink-900/40">
        <div className="mx-auto max-w-5xl px-5 py-8">
          <p className="text-center text-xs uppercase tracking-widest text-slate-600">
            Built for founders, product, pricing and strategy teams
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Everything you need to out-position rivals</h2>
          <p className="mt-3 text-slate-400">Replaces hours of research, spreadsheets and guesswork.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 transition hover:border-ink-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-soft">
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-ink-800/60 bg-ink-900/30">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Full report in three steps</h2>
            <p className="mt-3 text-slate-400">No setup. Just answers.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business / who it's for */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Turn market noise into clear strategy</h2>
            <p className="mt-4 text-slate-400">
              Most teams rely on scattered research and spreadsheets that go stale fast. Mira AI sizes your
              market, tracks competitors, and turns the signals into clear moves, so you act on evidence and
              never get blindsided.
            </p>
            <ul className="mt-6 space-y-3">
              {OUTCOMES.map((o) => (
                <li key={o} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950/40 text-emerald-400">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <div key={p.title} className="card p-5">
                <Icon name={p.icon} className="h-5 w-5 text-accent-soft" />
                <h3 className="mt-3 text-sm font-semibold text-white">{p.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-y border-ink-800/60 bg-ink-900/30">
        <div className="mx-auto max-w-4xl px-5 py-24 text-center">
          <span className="chip border-emerald-800/50 bg-emerald-950/30 text-emerald-300">Limited early-access spots</span>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">Be first in line</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Join the waitlist. We'll email your invite the moment it's ready.
          </p>
          <div className="mt-8">
            {authed ? (
              <Link href="/app" className="btn-primary px-6 py-3 text-base">
                <Icon name="sparkle" className="h-4 w-4" /> Go to app
              </Link>
            ) : (
              <WaitlistForm variant="cta" source="footer-cta" />
            )}
          </div>
          <p className="mt-4 text-xs text-slate-600">No credit card required.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
              <Icon name="radar" className="h-3.5 w-3.5" />
            </div>
            <span className="text-slate-400">Mira AI</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-slate-300 transition">Features</a>
            <a href="#how" className="hover:text-slate-300 transition">How it works</a>
          </div>
          <span className="text-xs text-slate-600">© {new Date().getFullYear()} · Powered by You.com + Grok</span>
        </div>
      </footer>

      {/* Waitlist modal — opened by the header button */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-ink-800 hover:text-slate-300"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
              <Icon name="sparkle" className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Join the waitlist</h3>
            <p className="mt-1.5 text-sm text-slate-400">
              Enter your email and we'll send your early-access invite to Mira AI when it's ready.
            </p>
            <div className="mt-5">
              <WaitlistForm variant="cta" source="header-modal" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: 'search', title: 'Competitor discovery', desc: 'Paste a URL and Mira finds your closest competitors, or add your own.' },
  { icon: 'activity', title: 'Market intelligence', desc: 'Market value, growth, and competitor funding, valuation and revenue from live finance research.' },
  { icon: 'eye', title: 'Company deep dive', desc: 'A full dossier on any company: overview, financials, web traffic and reviews.' },
  { icon: 'bar', title: 'Positioning map', desc: 'A price-vs-value chart showing who is best-value, premium or overpriced, with you plotted in.' },
  { icon: 'card', title: 'Pricing comparison', desc: 'Every competitor’s tiers and prices, side by side with charts.' },
  { icon: 'grid', title: 'Feature matrix', desc: 'Which features each competitor offers across tiers, in one grid.' },
  { icon: 'trending', title: 'Value scoring', desc: 'AI scores each competitor on value for money and explains why.' },
  { icon: 'users', title: 'Voice of the customer', desc: 'Real reviews from G2, Capterra and Trustpilot: ratings and sentiment.' },
  { icon: 'shield', title: 'SWOT & strategy', desc: 'Strengths, weaknesses, opportunities and threats, with moves to win.' },
  { icon: 'sparkle', title: 'AI analyst take', desc: 'A candid read on where you win, where you are exposed, and what to do next.' },
  { icon: 'bell', title: 'Change alerts', desc: 'Browser, webhook and Slack alerts when a competitor changes anything.' },
  { icon: 'share', title: 'Saved reports', desc: 'Save any report and reopen it anytime, fully cached.' },
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
