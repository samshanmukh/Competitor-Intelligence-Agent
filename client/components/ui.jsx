'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ─── Icons ───────────────────────────────────────────────────────────────────
const PATHS = {
  radar: <><circle cx="12" cy="12" r="9" /><path d="M12 12 7 7" /><path d="M12 3a9 9 0 0 1 9 9" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />,
};

export function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] ?? null}
    </svg>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`spinner ${className}`} role="status" aria-label="Loading" />;
}

export function ImpactBadge({ impact }) {
  const styles = {
    high: 'border-rose-800/60 bg-rose-950/40 text-rose-300',
    medium: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
    low: 'border-slate-700 bg-ink-800 text-slate-400',
  };
  return <span className={`chip ${styles[impact] || styles.low}`}>{impact || 'low'} impact</span>;
}

export function StatusDot({ competitor }) {
  let color = 'bg-slate-600';
  let title = 'Never checked';
  if (competitor.last_error) { color = 'bg-rose-500'; title = 'Last fetch failed'; }
  else if (competitor.last_changed_at) { color = 'bg-accent-soft'; title = 'Change detected'; }
  else if (competitor.last_checked_at) { color = 'bg-emerald-500'; title = 'Up to date'; }
  return <span title={title} className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function EmptyState({ icon = 'radar', title, children, action }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-850 text-accent-soft">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function timeAgo(iso) {
  if (!iso) return 'never';
  const d = new Date(/\dZ?$/.test(iso) && !iso.includes('T') ? iso.replace(' ', 'T') + 'Z' : iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Number.isNaN(diff)) return iso;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

// ─── Toast ───────────────────────────────────────────────────────────────────
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.duration || 4500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto card animate-pulse px-4 py-3 text-sm shadow-xl ${
              t.type === 'error' ? 'border-rose-800/60' : t.type === 'success' ? 'border-emerald-800/60' : ''
            }`}>
            <div className="flex items-start gap-2">
              <Icon
                name={t.type === 'error' ? 'alert' : t.type === 'success' ? 'check' : 'bell'}
                className={`mt-0.5 h-4 w-4 ${
                  t.type === 'error' ? 'text-rose-400' : t.type === 'success' ? 'text-emerald-400' : 'text-accent-soft'
                }`}
              />
              <div>
                {t.title && <div className="font-medium text-white">{t.title}</div>}
                {t.message && <div className="text-slate-400">{t.message}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
