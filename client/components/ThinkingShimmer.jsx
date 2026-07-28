'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * ChatGPT-style understated status label: muted text + soft gradient shimmer
 * across the letters (background-clip: text). No dots, spinners, or bounce.
 */
export default function ThinkingShimmer({
  label = 'Thinking…',
  className = '',
  as: Tag = 'p',
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Tag
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`thinking-shimmer m-0 text-sm font-normal tracking-tight text-slate-500 ${
        reduceMotion ? '' : 'thinking-shimmer--animate'
      } ${className}`}
    >
      <span className="thinking-shimmer__text">{label}</span>
    </Tag>
  );
}

/**
 * Crossfade between a thinking/status label and streamed (or final) content.
 * While `streaming` is true and there is no `children` content yet, shows ThinkingShimmer.
 * When content arrives, fades the status out and the body in.
 */
export function ThinkingStream({
  status = 'Thinking…',
  streaming = false,
  children,
  className = '',
  statusClassName = '',
  bodyClassName = '',
}) {
  const reduceMotion = useReducedMotion();
  const hasBody = Boolean(
    children != null
    && !(typeof children === 'string' && !children.trim()),
  );
  const showStatus = streaming && !hasBody;
  const showBody = hasBody;

  const fade = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] },
      };

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="sync" initial={false}>
        {showStatus ? (
          <motion.div key={`status-${status}`} {...fade}>
            <ThinkingShimmer label={status} className={statusClassName} />
          </motion.div>
        ) : null}
        {showBody ? (
          <motion.div
            key="body"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }
            }
            className={bodyClassName}
          >
            {streaming && status && hasBody ? (
              <p className="sr-only" aria-live="polite">
                {status}
              </p>
            ) : null}
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Small interactive demo: Thinking → Searching → Analyzing → streamed reply.
 * Useful for Storybook / local preview; not mounted in production routes by default.
 */
export function ThinkingShimmerDemo() {
  const phases = ['Thinking…', 'Searching…', 'Analyzing…'];
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState(0);
  const [streaming, setStreaming] = useState(true);
  const [text, setText] = useState('');

  useEffect(() => {
    setText('');
    setStreaming(true);
    setPhase(0);

    let intervalId;
    const timeouts = [
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setPhase(2), 2400),
      setTimeout(() => {
        const full =
          'Mira found three rivals with clearer entry pricing than your current plan. '
          + 'Bronze sits near $16.99/mo; annual tiers often discount ~17–20%.';
        let i = 0;
        intervalId = setInterval(() => {
          i += 2;
          setText(full.slice(0, i));
          if (i >= full.length) {
            clearInterval(intervalId);
            intervalId = undefined;
            setStreaming(false);
          }
        }, 28);
      }, 3200),
    ];

    return () => {
      timeouts.forEach(clearTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [runId]);

  return (
    <div className="max-w-md rounded-2xl border border-white/10 bg-ink-900/80 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Thinking shimmer demo
        </p>
        <button
          type="button"
          onClick={() => setRunId((n) => n + 1)}
          className="text-[11px] text-slate-500 transition hover:text-slate-300"
        >
          Replay
        </button>
      </div>
      <ThinkingStream status={phases[phase]} streaming={streaming || !text}>
        {text ? (
          <p className="text-sm leading-relaxed text-slate-200">
            {text}
            {streaming ? (
              <span
                className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-slate-500/80 align-middle"
                aria-hidden
              />
            ) : null}
          </p>
        ) : null}
      </ThinkingStream>
    </div>
  );
}
