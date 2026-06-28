'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './ui';

function NavItem({ href, icon, label, badge, exact = false }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        isActive ? 'bg-ink-800 text-white' : 'text-slate-400 hover:bg-ink-850 hover:text-slate-200'
      }`}
    >
      <Icon name={icon} className="h-4 w-4" />
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const [unseen, setUnseen] = useState(0);

  const refreshUnseen = async () => {
    try {
      const { unseen } = await api.unseenCount();
      setUnseen(unseen);
    } catch { /* offline */ }
  };

  useEffect(() => {
    refreshUnseen();
    const t = setInterval(refreshUnseen, 30_000);
    return () => clearInterval(t);
  }, []);

  const nav = (
    <nav className="flex flex-col gap-1">
      <NavItem href="/" icon="radar" label="Dashboard" exact />
      <NavItem href="/discover" icon="search" label="Discover" />
      <NavItem href="/changes" icon="bell" label="Changes" badge={unseen} />
      <NavItem href="/settings" icon="settings" label="Settings" />
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900/60 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
            <Icon name="radar" className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Pricing Intel</div>
            <div className="text-[11px] text-slate-500">competitor agent</div>
          </div>
        </div>
        {nav}
        <div className="mt-auto rounded-lg border border-ink-800 bg-ink-850/60 p-3 text-[11px] leading-relaxed text-slate-500">
          Powered by <span className="text-slate-300">You.com</span> +{' '}
          <span className="text-slate-300">Grok</span>. Auto-refreshes every 24h.
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="flex items-center gap-1 border-b border-ink-800 bg-ink-900/60 px-3 py-2 md:hidden">
        <NavItem href="/" icon="radar" label="Dashboard" exact />
        <NavItem href="/discover" icon="search" label="Discover" />
        <NavItem href="/changes" icon="bell" label="Changes" badge={unseen} />
        <NavItem href="/settings" icon="settings" label="Settings" />
      </div>
    </>
  );
}
