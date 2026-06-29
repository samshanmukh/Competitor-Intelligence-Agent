'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './ui';

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(Boolean(typeof window !== 'undefined' && localStorage.getItem('cia_token')));
  }, []);

  const primaryHref = authed ? '/app' : '/signup';
  const primaryLabel = authed ? 'Go to app' : 'Get started free';

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-800/60 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
              <Icon name="radar" className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-white">Competitor Intelligence Agent</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how" className="hover:text-white transition">How it works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {!authed && <Link href="/login" className="btn-ghost py-1.5 px-3 text-sm">Sign in</Link>}
            <Link href={primaryHref} className="btn-primary py-1.5 px-3 text-sm">{primaryLabel}</Link>
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
            <Icon name="sparkle" className="h-3 w-3" /> AI-powered competitive intelligence
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl">
            Know your market<br className="hidden sm:block" /> in minutes, not weeks
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Add your product. The agent finds your closest competitors, compares pricing and value,
            reads real user reviews, and tells you exactly how to position and price.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={primaryHref} className="btn-primary px-5 py-2.5 text-base">
              <Icon name="sparkle" className="h-4 w-4" /> {primaryLabel}
            </Link>
            <a href="#how" className="btn-ghost px-5 py-2.5 text-base">See how it works</a>
          </div>
          <p className="mt-4 text-xs text-slate-600">No credit card required · Free plan tracks 3 competitors</p>
        </div>

        {/* Product preview mock */}
        <div className="mx-auto max-w-4xl px-5 pb-16">
          <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-ink-800 bg-ink-850 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-3 text-xs text-slate-500">Competitive report — Acme Analytics</span>
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
                  "Two competitors anchor the premium tier at $99/mo while the mid-market is underserved between
                  $25–$49. You can win on price-to-value here — I'd test a $39 Pro plan and lead with your
                  integrations advantage."
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
            Built for founders, product & pricing teams, and competitive-intel analysts
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Everything you need to out-position competitors</h2>
          <p className="mt-3 text-slate-400">One agent replaces hours of manual research, spreadsheets, and guesswork.</p>
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
            <h2 className="text-3xl font-bold text-white md:text-4xl">From product to full report in 3 steps</h2>
            <p className="mt-3 text-slate-400">No setup, no spreadsheets. Just answers.</p>
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
            <h2 className="text-3xl font-bold text-white md:text-4xl">Turn competitive noise into pricing decisions</h2>
            <p className="mt-4 text-slate-400">
              Most teams check competitors a few times a year, in a spreadsheet that's stale the day it's made.
              The agent monitors continuously and translates raw pricing pages into clear, defensible moves —
              so you price with confidence and never get blindsided by a competitor's change.
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

      {/* Pricing */}
      <section id="pricing" className="border-y border-ink-800/60 bg-ink-900/30">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Simple, scalable pricing</h2>
            <p className="mt-3 text-slate-400">Start free. Upgrade when you're ready to track your whole market.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.name}
                className={`card flex flex-col p-6 ${plan.featured ? 'border-accent/50 ring-1 ring-accent/30' : ''}`}>
                {plan.featured && (
                  <span className="mb-3 w-fit chip border-accent/40 bg-accent/10 text-accent-soft">Most popular</span>
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{plan.name}</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.per && <span className="mb-1 text-sm text-slate-500">{plan.per}</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={primaryHref}
                  className={`mt-6 w-full justify-center ${plan.featured ? 'btn-primary' : 'btn-ghost'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center">
        <h2 className="text-3xl font-bold text-white md:text-4xl">See where you really stand</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Add your product and get a full competitive report — pricing, value, reviews, and a clear next move — in minutes.
        </p>
        <div className="mt-8">
          <Link href={primaryHref} className="btn-primary px-6 py-3 text-base">
            <Icon name="sparkle" className="h-4 w-4" /> {primaryLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
              <Icon name="radar" className="h-3.5 w-3.5" />
            </div>
            <span className="text-slate-400">Competitor Intelligence Agent</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-slate-300 transition">Features</a>
            <a href="#pricing" className="hover:text-slate-300 transition">Pricing</a>
            <Link href="/login" className="hover:text-slate-300 transition">Sign in</Link>
          </div>
          <span className="text-xs text-slate-600">© {new Date().getFullYear()} · Powered by You.com + Grok</span>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: 'search', title: 'Automatic competitor discovery', desc: 'Describe your product or paste a URL — the agent searches the web and confirms your closest competitors. Or add your own by name, URL and description and discover more like them.' },
  { icon: 'bar', title: 'Visual positioning map', desc: 'An interactive price-vs-value chart that instantly shows who’s best-value, premium, budget, or overpriced — with your field plotted side by side.' },
  { icon: 'card', title: 'Pricing & plans comparison', desc: 'Every competitor’s tiers and prices extracted and laid out side by side, with comparison bar charts.' },
  { icon: 'grid', title: 'Feature matrix', desc: 'See exactly which features each competitor offers across tiers in one interactive grid.' },
  { icon: 'trending', title: 'Value-for-money scoring', desc: 'AI scores each competitor on value vs. price and explains the reasoning, charted for quick comparison.' },
  { icon: 'users', title: 'Voice of the customer', desc: 'Pulls real reviews from G2, Capterra and Trustpilot — star ratings, sentiment, and what users love vs. complain about.' },
  { icon: 'sparkle', title: 'AI analyst take', desc: 'A candid, first-person briefing: your read on the market, where you win, where you’re exposed, and what to do next.' },
  { icon: 'bell', title: 'Change monitoring & alerts', desc: 'Continuous tracking with browser, webhook and Slack alerts the moment a competitor changes pricing.' },
  { icon: 'share', title: 'Saved report history', desc: 'Save any analysis and reopen it anytime — full charts, pricing and reviews cached, so you never re-run or burn tokens.' },
];

const STEPS = [
  { title: 'Add your product', desc: 'Enter your company name and (optionally) your product URL. The agent reads your site to understand your market.' },
  { title: 'Find & confirm competitors', desc: 'The agent searches the web for your closest competitors. Review the list and confirm who to track.' },
  { title: 'Get your report', desc: 'One click produces pricing, feature matrix, value scores, review sentiment, and an analyst’s recommendation.' },
];

const OUTCOMES = [
  'Price with confidence using value-based evidence, not guesswork',
  'Spot underserved gaps and premium pockets in your market',
  'Get alerted the instant a competitor changes pricing',
  'Walk into deals with battlecards that handle every objection',
];

const PERSONAS = [
  { icon: 'sparkle', title: 'Founders', desc: 'Understand your market and set defensible pricing without hiring an analyst.' },
  { icon: 'trending', title: 'Product & pricing', desc: 'Back every pricing decision with continuous, structured competitive data.' },
  { icon: 'shield', title: 'Sales teams', desc: 'Win more deals with always-current battlecards and competitor intel.' },
  { icon: 'users', title: 'Strategy & research', desc: 'Replace stale spreadsheets with a live view of the whole landscape.' },
];

const PLANS = [
  {
    name: 'Free', price: '$0', per: '', tagline: 'For getting started',
    cta: 'Start free',
    features: ['Track up to 3 competitors', 'Pricing & feature comparison', 'Value scoring', 'Manual refresh'],
  },
  {
    name: 'Pro', price: '$49', per: '/mo', tagline: 'For growing teams', featured: true,
    cta: 'Start Pro',
    features: ['Track up to 20 competitors', 'Review sentiment + analyst take', 'Change monitoring & alerts', 'Reports & CSV export', 'Up to 5 team members'],
  },
  {
    name: 'Enterprise', price: '$199', per: '/mo', tagline: 'For the whole org',
    cta: 'Contact sales',
    features: ['Unlimited competitors', 'Unlimited team members', 'Battlecards & CRM integration', 'White-label reports', 'Priority support'],
  },
];
