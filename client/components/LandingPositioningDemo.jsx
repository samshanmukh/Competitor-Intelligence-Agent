'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import PositioningMapChart from './PositioningMapChart';
import { Icon } from './ui';

const STEPS = [
  'Reading your pricing page…',
  'Finding competitors…',
  'Scoring entry price vs. value…',
  'Building your positioning map…',
];

export default function LandingPositioningDemo() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste your product or pricing page URL.');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    setStepIdx(0);

    const timer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, 4500);

    try {
      const data = await api.demoPositioningMap(trimmed);
      setResult(data);
      setStepIdx(STEPS.length - 1);
    } catch (err) {
      setError(err?.message || 'Could not build the map. Try another URL or create an account.');
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  const plottable = result
    ? [result.you, ...(result.rivals || [])].filter(
        (c) => c && c.entry_price != null && c.value_score != null
      )
    : [];

  return (
    <div className={`mx-auto w-full text-left ${result ? 'max-w-3xl' : 'max-w-xl'}`}>
      <form onSubmit={onSubmit} className="relative">
        <label htmlFor="landing-pricing-url" className="sr-only">
          Company pricing URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            id="landing-pricing-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yoursite.com/pricing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="w-full flex-1 rounded-md border border-white/15 bg-white/5 px-5 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none ring-accent/40 transition focus:border-accent/50 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent-dim disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Mapping…
              </>
            ) : (
              <>
                <Icon name="sparkle" className="h-4 w-4" />
                Map competitors
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500 sm:text-left">
          Paste a pricing URL — we discover rivals and plot entry price vs. value.
        </p>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-5 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-200">{STEPS[stepIdx]}</p>
          <p className="mt-1 text-xs text-slate-500">Usually 30–90 seconds. Keep this tab open.</p>
          <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="mt-6 space-y-4">
          {result.market && (
            <p className="text-center text-xs text-slate-400 sm:text-left">
              Market: <span className="text-slate-300">{result.market}</span>
            </p>
          )}
          {plottable.length >= 1 ? (
            <PositioningMapChart you={result.you} rivals={result.rivals || []} />
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-amber-100/90">
              We found competitors, but couldn&apos;t extract enough public pricing to plot the map.
              Try a clearer pricing page, or create an account for a full report.
            </div>
          )}
          <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200"
            >
              Save this &amp; get the full report
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError('');
              }}
              className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Try another URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
