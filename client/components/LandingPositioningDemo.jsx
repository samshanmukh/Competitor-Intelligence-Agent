'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api } from '../lib/api';
import PositioningMapChart from './PositioningMapChart';
import { Icon } from './ui';

const EASE = [0.21, 0.47, 0.32, 0.98];

const STATUS_LABELS = {
  cache: 'Loading cached result…',
  search: 'Finding competitors…',
  extract: 'Naming rivals…',
  pricing: 'Reading pricing pages…',
};

export default function LandingPositioningDemo() {
  const reduceMotion = useReducedMotion();
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

  const entities = display
    ? [display.you, ...(display.rivals || [])].filter((c) => c && (c.name || c.website))
    : [];
  // Chart plots everyone — unpriced rivals sit in an "n/a" lane (not omitted).
  const showChart = entities.length >= 2;

  const fade = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 4 },
        transition: { duration: 0.35, ease: EASE },
      };

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

      <AnimatePresence mode="wait">
        {loading && !partialNames && (
          <motion.div
            key="loading"
            {...fade}
            className="mt-5 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-5 text-center"
          >
            <p className="text-sm font-medium text-slate-200">{statusLabel || 'Finding competitors…'}</p>
            <p className="mt-1 text-xs text-slate-500">Usually under 20 seconds. Keep this tab open.</p>
            <div className="mx-auto mt-4 max-w-sm space-y-2 text-left">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-8 rounded-md bg-white/5 ${reduceMotion ? '' : 'animate-pulse'}`}
                  style={reduceMotion ? undefined : { animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {display && (
        <motion.div
          className="mt-6 space-y-4"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: EASE }}
        >
          {display.market && (
            <p className="text-center text-xs text-slate-400 sm:text-left">
              Market: <span className="text-slate-300">{display.market}</span>
              {loading && (
                <span className="ml-2 text-slate-500">· {statusLabel || 'Fetching prices…'}</span>
              )}
            </p>
          )}

          {(display.you?.statement || display.you?.blurb) && (
            <p className="mx-auto line-clamp-2 max-w-2xl text-center text-sm leading-snug text-slate-400 sm:mx-0 sm:text-left">
              {display.you.statement || display.you.blurb}
            </p>
          )}

          {showChart && (
            <PositioningMapChart
              you={display.you}
              rivals={display.rivals || []}
              streaming={loading}
              hint="Hover a marker for name, price, and value. Click to pin. Muted markers = price not found yet."
            />
          )}

          {!loading && !showChart && (display.rivals || []).length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-sm text-amber-100/90">
              We found competitors, but need a bit more context to plot the map.
              Try a clearer pricing page, or create an account for a full report.
            </div>
          )}

          {!loading && !showChart && (display.rivals || []).length === 0 && (
            <p className="text-center text-sm text-slate-500 sm:text-left">
              No clear rivals found for this URL.
            </p>
          )}

          {!loading && (
            <motion.div
              className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.1, ease: EASE }}
            >
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
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
