'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import PositioningMapChart from './PositioningMapChart';
import { Icon } from './ui';

const STATUS_LABELS = {
  cache: 'Loading cached result…',
  search: 'Finding competitors…',
  extract: 'Naming rivals…',
  pricing: 'Reading pricing pages…',
};

function formatPrice(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 100) return `$${Math.round(n)}/mo`;
  return `$${Number(n.toFixed(n < 10 ? 2 : 0))}/mo`;
}

export default function LandingPositioningDemo() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [partialNames, setPartialNames] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste your product or pricing page URL.');
      return;
    }
    setError('');
    setResult(null);
    setPartialNames(null);
    setLoading(true);
    setStatusLabel('Finding competitors…');

    try {
      const data = await api.demoCompetitorsFastStream(trimmed, (event, payload) => {
        if (event === 'status') {
          setStatusLabel(payload?.label || STATUS_LABELS[payload?.step] || 'Working…');
        }
        if (event === 'competitors') {
          setPartialNames({
            market: payload?.market,
            you: payload?.you,
            rivals: payload?.rivals || [],
          });
          setStatusLabel('Reading pricing pages…');
        }
        if (event === 'pricing' || event === 'done') {
          if (payload?.you || payload?.rivals) {
            setResult((prev) => ({
              market: payload.market || prev?.market || partialNames?.market,
              you: payload.you || prev?.you,
              rivals: payload.rivals || prev?.rivals || [],
              partial: payload.partial,
              timings: payload.timings,
            }));
          }
        }
        if (event === 'rival' && payload?.role === 'you') {
          setResult((prev) => ({
            market: prev?.market || partialNames?.market,
            you: { ...(prev?.you || {}), ...payload, isYou: true },
            rivals: prev?.rivals || partialNames?.rivals || [],
          }));
        }
        if (event === 'rival' && payload?.role === 'rival') {
          setResult((prev) => {
            const baseRivals = prev?.rivals || partialNames?.rivals || [];
            const rivals = baseRivals.map((r) =>
              r.name === payload.name || r.website === payload.website
                ? { ...r, ...payload }
                : r
            );
            const known = rivals.some(
              (r) => r.name === payload.name || r.website === payload.website
            );
            return {
              market: prev?.market || partialNames?.market,
              you: prev?.you || partialNames?.you,
              rivals: known ? rivals : [...rivals, payload],
            };
          });
        }
      });

      if (data) {
        setResult({
          market: data.market,
          you: data.you,
          rivals: data.rivals || [],
          partial: data.partial,
          timings: data.timings,
        });
      }
    } catch (err) {
      setError(err?.message || 'Could not map competitors. Try another URL or create an account.');
    } finally {
      setLoading(false);
      setStatusLabel('');
    }
  }

  const display = result || (partialNames
    ? {
        market: partialNames.market,
        you: { ...partialNames.you, entry_price: null, isYou: true },
        rivals: (partialNames.rivals || []).map((r) => ({ ...r, entry_price: null })),
      }
    : null);

  const priced = display
    ? [display.you, ...(display.rivals || [])].filter((c) => c && c.entry_price != null)
    : [];
  const showChart = priced.length >= 2
    && priced.every((c) => c.value_score != null);

  return (
    <div className={`mx-auto w-full text-left ${display ? 'max-w-3xl' : 'max-w-xl'}`}>
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
          Paste a pricing URL — usually under 20 seconds.
        </p>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}

      {loading && !partialNames && (
        <div className="mt-5 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-200">{statusLabel || 'Finding competitors…'}</p>
          <p className="mt-1 text-xs text-slate-500">Usually under 20 seconds. Keep this tab open.</p>
          <div className="mx-auto mt-4 space-y-2 max-w-sm text-left">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-white/5" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      )}

      {display && (
        <div className="mt-6 space-y-4">
          {display.market && (
            <p className="text-center text-xs text-slate-400 sm:text-left">
              Market: <span className="text-slate-300">{display.market}</span>
              {loading && (
                <span className="ml-2 text-slate-500">· {statusLabel || 'Fetching prices…'}</span>
              )}
            </p>
          )}

          {/* Progressive name list while prices load */}
          {(loading || !showChart) && (
            <ul className="space-y-2 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3">
              {display.you && (
                <li className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-accent-soft">
                    {display.you.name || 'You'}
                    <span className="ml-1.5 text-xs font-normal text-slate-500">(you)</span>
                  </span>
                  <span className="tabular-nums text-slate-300">
                    {display.you.entry_price != null
                      ? formatPrice(display.you.entry_price)
                      : (loading ? <span className="inline-block h-3 w-12 animate-pulse rounded bg-white/10" /> : '—')}
                  </span>
                </li>
              )}
              {(display.rivals || []).map((r) => (
                <li key={r.website || r.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-200">{r.name}</span>
                  <span className="tabular-nums text-slate-300">
                    {r.entry_price != null
                      ? formatPrice(r.entry_price)
                      : (loading ? <span className="inline-block h-3 w-12 animate-pulse rounded bg-white/10" /> : '—')}
                  </span>
                </li>
              ))}
              {!loading && (display.rivals || []).length === 0 && (
                <li className="text-sm text-slate-500">No clear rivals found for this URL.</li>
              )}
            </ul>
          )}

          {!loading && showChart && (
            <PositioningMapChart
              you={display.you}
              rivals={display.rivals || []}
              hint="Entry price vs. relative value (cheaper plans score higher in this quick preview). Full analysis scores value from features and positioning."
            />
          )}

          {!loading && !showChart && priced.length < 2 && (display.rivals || []).length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-amber-100/90">
              We found competitors, but couldn&apos;t extract enough public pricing to plot the map.
              Try a clearer pricing page, or create an account for a full report.
            </div>
          )}

          {!loading && (
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
                  setPartialNames(null);
                  setError('');
                }}
                className="rounded-md border border-white/15 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-white/5"
              >
                Try another URL
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
