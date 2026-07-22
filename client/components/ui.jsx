'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { companyLogoUrl } from '../lib/companyLogo';

// ─── Icons ────────────────────────────────────────────────────────────────────
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
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M17.9 17.9A10 10 0 0 1 12 19c-7 0-10-7-10-7a18.5 18.5 0 0 1 5.1-6.9" /><path d="M10.5 6.1A10 10 0 0 1 12 6c7 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2" /><path d="m2 2 20 20" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
  trending: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>,
  card: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
  bar: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
  map: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
};

export function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] ?? null}
    </svg>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`spinner ${className}`} role="status" aria-label="Loading" />;
}

/** Company mark from website/pricing URL (Google favicon), with letter fallback. */
export function CompanyLogo({
  name = '?',
  website,
  pricing_url,
  url,
  domain,
  className = 'h-9 w-9 rounded-lg',
  textClassName = 'text-sm',
}) {
  const src = companyLogoUrl({ website, pricing_url, url, domain });
  const [failed, setFailed] = useState(false);
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center bg-ink-800 font-bold text-slate-400 ${textClassName} ${className}`}
        aria-hidden="true"
      >
        {letter}
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 overflow-hidden bg-ink-800 ${className}`} aria-hidden="true">
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain p-1.5"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-ink-800 ${className}`} />;
}

// ─── Impact Badge ────────────────────────────────────────────────────────────
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
  return (
    <span title={title} className="inline-flex items-center">
      <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="sr-only">{title}</span>
    </span>
  );
}

// ─── Value Score ─────────────────────────────────────────────────────────────
export function ValueScore({ score }) {
  if (score == null) return <span className="text-slate-600 text-xs">–</span>;
  const color = score >= 7 ? 'text-emerald-400' : score >= 4 ? 'text-amber-400' : 'text-rose-400';
  return <span className={`font-bold tabular-nums ${color}`}>{score.toFixed(1)}/10</span>;
}

// ─── Empty State ─────────────────────────────────────────────────────────────
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

// ─── KPI Card ────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, icon, trend, color = 'accent' }) {
  const colors = {
    accent: 'text-accent-soft bg-accent/10',
    green: 'text-emerald-400 bg-emerald-950/40',
    amber: 'text-amber-400 bg-amber-950/40',
    rose: 'text-rose-400 bg-rose-950/40',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-white tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[color]}`}>
            <Icon name={icon} className="h-4 w-4" />
          </div>
        )}
      </div>
      {trend != null && (
        <div className={`mt-3 flex items-center gap-1 text-xs ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
          <Icon name={trend > 0 ? 'trending' : trend < 0 ? 'trending' : 'activity'} className="h-3 w-3" />
          {trend > 0 ? `+${trend}` : trend} vs last week
        </div>
      )}
    </div>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────
export function TabBar({ tabs, active, onChange }) {
  const buttonRefs = useRef([]);

  const selectByIndex = (index) => {
    const nextIndex = (index + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectByIndex(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectByIndex(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectByIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectByIndex(tabs.length - 1);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label="View options"
        className="inline-flex min-w-full items-center gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1 sm:min-w-0 sm:w-fit"
      >
        {tabs.map((t, index) => (
          <button
            key={t.id}
            ref={(node) => { buttonRefs.current[index] = node; }}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            aria-controls={t.panelId}
            id={t.tabId}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-3 sm:py-1.5 ${
              active === t.id
                ? 'bg-ink-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon && <Icon name={t.icon} className="h-3.5 w-3.5 shrink-0" />}
            <span>{t.label}</span>
            {t.count != null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                active === t.id ? 'bg-ink-600 text-slate-200' : 'bg-ink-800 text-slate-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector('[autofocus]');
      const firstFocusable = dialogRef.current?.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (preferred || firstFocusable || dialogRef.current)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative ${width} max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain card shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1 text-slate-500 transition hover:bg-ink-800 hover:text-white">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-sm text-slate-400">{message}</p>
      <div className="mt-4 flex gap-2 justify-end">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={danger ? 'btn-danger' : 'btn-primary'}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}

// ─── Notification Bell ───────────────────────────────────────────────────────
export function NotificationBell({ unseen = 0 }) {
  // Start with a stable value for SSR; read the real permission only after mount
  // to avoid a server/client hydration mismatch.
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  const enable = async () => {
    if (permission !== 'default') return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const { api } = await import('../lib/api');
        const { key } = await api.vapidKey();
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
        await api.pushSubscribe(sub.toJSON(), ['any', 'high-impact']);
      } catch {
        // Silent on the bell — the Settings → Notifications tab surfaces the detailed error.
      }
    }
  };

  return (
    <button
      onClick={enable}
      title={permission === 'granted' ? 'Notifications on' : 'Enable notifications'}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-ink-800 hover:text-white transition"
    >
      <Icon name="bell" className="h-4 w-4" />
      {unseen > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
          {unseen > 99 ? '99+' : unseen}
        </span>
      )}
      {permission === 'granted' && unseen === 0 && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
      )}
    </button>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ─── Workspace Switcher ──────────────────────────────────────────────────────
export function WorkspaceSwitcher({ workspace, workspaces, onSwitch, onCreate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800 transition"
      >
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-accent/20 text-accent-soft text-[10px] font-bold uppercase">
          {(workspace?.name || 'W')[0]}
        </div>
        <span className="flex-1 truncate text-left font-medium text-slate-200 text-xs">
          {workspace?.name || 'Workspace'}
        </span>
        <Icon name="chevronDown" className="h-3 w-3 text-slate-500" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-52 rounded-xl border border-ink-700 bg-ink-900 p-1 shadow-xl z-50">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onSwitch(ws); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                ws.id === workspace?.id ? 'bg-ink-800 text-white' : 'text-slate-400 hover:bg-ink-800 hover:text-white'
              }`}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/20 text-accent-soft text-[9px] font-bold uppercase">
                {(ws.name || 'W')[0]}
              </div>
              <span className="truncate">{ws.name}</span>
              {ws.id === workspace?.id && <Icon name="check" className="ml-auto h-3 w-3 text-accent-soft" />}
            </button>
          ))}
          <div className="my-1 border-t border-ink-700" />
          <button
            onClick={() => { onCreate(); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-ink-800 hover:text-slate-200 transition"
          >
            <Icon name="plus" className="h-4 w-4" />
            New workspace
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Time Utility ─────────────────────────────────────────────────────────────
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
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            className={`pointer-events-auto card px-4 py-3 text-sm shadow-xl transition-all ${
              t.type === 'error' ? 'border-rose-800/60' : t.type === 'success' ? 'border-emerald-800/60' : ''
            }`}>
            <div className="flex items-start gap-2">
              <Icon
                name={t.type === 'error' ? 'alert' : t.type === 'success' ? 'check' : 'bell'}
                className={`mt-0.5 h-4 w-4 shrink-0 ${
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
