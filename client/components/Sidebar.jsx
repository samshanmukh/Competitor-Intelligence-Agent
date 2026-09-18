'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon, Modal } from './ui';
import BrandLogo from './BrandLogo';

function NavItem({ href, icon, label, badge, exact = false, collapsed = false, onNavigate }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
      className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10'
          : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
      } ${collapsed ? 'relative justify-center' : ''}`}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0 opacity-80" />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
      {collapsed && badge > 0 && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-accent" />
      )}
    </Link>
  );
}

function NavGroup({ label, children, collapsed }) {
  if (collapsed) return <>{children}</>;
  return (
    <div className="space-y-0.5">
      <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-slate-600">{label}</p>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderNav = (isCollapsed = false, onNavigate) => (
    <NavGroup label="Research" collapsed={isCollapsed}>
      <NavItem href="/app" icon="sparkle" label="Analysis" exact collapsed={isCollapsed} onNavigate={onNavigate} />
      <NavItem href="/market" icon="bar" label="Market model" collapsed={isCollapsed} onNavigate={onNavigate} />
      <NavItem href="/company" icon="map" label="Deep market search" collapsed={isCollapsed} onNavigate={onNavigate} />
    </NavGroup>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`glass-nav sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r p-4 transition-all duration-200 md:flex ${collapsed ? 'w-[4.5rem]' : 'w-60'}`}>
        {/* Logo + collapse */}
        <div className={`mb-8 flex ${collapsed ? 'flex-col items-center gap-2' : 'items-center gap-2 px-1'}`}>
          {collapsed ? (
            <BrandLogo href="/app" variant="mark" height={28} />
          ) : (
            <div className="min-w-0 flex-1">
              <BrandLogo href="/app" height={26} />
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-colors duration-200 hover:bg-ink-800 hover:text-slate-300 ${collapsed ? '' : 'ml-auto'}`}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pr-0.5">
          {renderNav(collapsed)}
        </nav>

      </aside>

      {/* Mobile top bar */}
      <header className="glass-nav sticky top-0 z-30 flex w-full items-center justify-between border-b px-4 py-3 md:hidden">
        <BrandLogo href="/app" height={24} />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          className="relative flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-ink-600 hover:text-white"
        >
          <Icon name="list" className="h-4 w-4" />
          Menu
        </button>
      </header>

      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation" width="max-w-sm">
        <nav aria-label="Mobile primary navigation" className="flex max-h-[calc(100dvh-11rem)] flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
          {renderNav(false, () => setMobileOpen(false))}
        </nav>
      </Modal>
    </>
  );
}
