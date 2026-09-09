'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api } from '../lib/api';
import { ensureHttps } from '../lib/normalizeUrl';
import PositioningMapChart from './PositioningMapChart';
import ThinkingShimmer from './ThinkingShimmer';
import { Icon } from './ui';

const EASE = [0.21, 0.47, 0.32, 0.98];

/** Pipeline stages → calm status copy (mirrors SSE `step` when label missing). */
const STATUS_LABELS = {
  start: 'Starting…',
  cache: 'Loading cached result…',
  search: 'Looking up company…',
  identity: 'Looking up company…',
  extract: 'Naming rivals…',
  competitors: 'Naming rivals…',
  pricing: 'Plotting map…',
  plot: 'Plotting map…',
  done: 'Plotting map…',
};

/** Stepped progress by pipeline stage (about → rivals → plot). */
const STAGE_PROGRESS = {
  start: 8,
  cache: 92,
  search: 22,
  identity: 38,
  extract: 55,
  competitors: 70,
  pricing: 88,
  plot: 92,
  done: 100,
};

function labelForStatus(payload) {
  if (payload?.label) return payload.label;
  if (payload?.step && STATUS_LABELS[payload.step]) return STATUS_LABELS[payload.step];
  return 'Starting…';
}

export default function LandingPositioningDemo() {
  const reduceMotion = useReducedMotion();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [partialNames, setPartialNames] = useState(null);

  function setStage(step, label) {
    setStatusLabel(label || STATUS_LABELS[step] || 'Starting…');
    setProgress(STAGE_PROGRESS[step] ?? 8);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = ensureHttps(url);
    if (!trimmed) {
      setError('Paste your product or pricing page URL.');
      return;
    }
    if (trimmed !== url.trim()) setUrl(trimmed);
    setError('');
    setResult(null);
    setPartialNames(null);
    setLoading(true);
    setStage('start');

    try {
      const data = await api.demoCompetitorsFastStream(trimmed, (event, payload) => {
        if (event === 'status') {
          const step = payload?.step || 'search';
          setStage(step, labelForStatus(payload));
        }
        if (event === 'competitors') {
          setPartialNames({
            market: payload?.market,
            you: payload?.you,
            rivals: payload?.rivals || [],
          });
          setStage('competitors');
        }
        if (event === 'pricing' || event === 'done') {
          setStage(event === 'done' ? 'done' : 'plot');
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
          setStage('pricing');
          setResult((prev) => ({
            market: prev?.market || partialNames?.market,
            you: { ...(prev?.you || {}), ...payload, isYou: true },
            rivals: prev?.rivals || partialNames?.rivals || [],
          }));
        }
        if (event === 'rival' && payload?.role === 'rival') {
          setStage('pricing');
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
      setError(err?.message || 'Could not map competitors. Try another URL or open the full app.');
    } finally {
      setLoading(false);
      setStatusLabel('');
      setProgress(0);
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
  const showLoadingPanel = loading && !display;

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
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yoursite.com/pricing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              const next = ensureHttps(url);
              if (next && next !== url) setUrl(next);
            }}
            disabled={loading}
            className="w-full flex-1 rounded-md border border-white/15 bg-white/5 px-5 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none ring-accent/40 transition focus:border-accent/50 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent-dim disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? (
              'Mapping…'
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
        {showLoadingPanel ? (
          <motion.div
            key="loading"
            {...fade}
            className="mt-5 px-1 py-5 text-center"
          >
            <ThinkingShimmer
              label={statusLabel || 'Starting…'}
              className="text-center"
            />
            <div
              className="mx-auto mt-4 h-0.5 max-w-[12rem] overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Mapping progress"
            >
              <motion.div
                className="h-full rounded-full bg-slate-400/70"
                initial={false}
                animate={{ width: `${Math.max(progress, 6)}%` }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.45, ease: EASE }
                }
              />
            </div>
            <p className="mt-3 text-xs text-slate-600">Usually under 20 seconds. Keep this tab open.</p>
          </motion.div>
        ) : display ? (
          <motion.div
            key="result"
            className="mt-6 space-y-4"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: EASE }}
          >
            {display.market && (
              <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center text-xs text-slate-400 sm:justify-start sm:text-left">
                <p className="m-0">
                  Market: <span className="text-slate-300">{display.market}</span>
                </p>
                {loading ? (
                  <ThinkingShimmer
                    label={statusLabel || 'Plotting map…'}
                    className="text-xs"
                  />
                ) : null}
              </div>
            )}

            {(() => {
              const blurb = display.you?.statement || display.you?.blurb || '';
              if (!blurb || /no information available/i.test(blurb)) return null;
              return (
                <p className="mx-auto line-clamp-2 max-w-2xl text-center text-sm leading-snug text-slate-400 sm:mx-0 sm:text-left">
                  {blurb}
                </p>
              );
            })()}

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
                Try a clearer pricing page, or open the full app for a complete report.
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
                  href="/app"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200"
                >
                  Open the full report
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
        ) : null}
      </AnimatePresence>
    </div>
  );
}
