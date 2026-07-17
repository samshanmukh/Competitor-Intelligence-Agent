'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace, fetchWorkspaces, signOut, switchWorkspace } from '../lib/auth';
import { Icon, WorkspaceSwitcher, Modal } from './ui';

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
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
        isActive
          ? 'bg-ink-800 text-white'
          : 'text-slate-400 hover:bg-ink-800/70 hover:text-slate-200'
      } ${collapsed ? 'relative justify-center' : ''}`}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
      {collapsed && badge > 0 && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent border-2 border-ink-950" />
      )}
    </Link>
  );
}

function NavGroup({ label, children, collapsed }) {
  if (collapsed) return <>{children}</>;
  return (
    <div className="space-y-0.5">
      <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{label}</p>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const [unseen, setUnseen] = useState(0);
  const [workspace, setWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newWsModal, setNewWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  useEffect(() => {
    setWorkspace(getWorkspace());
    fetchWorkspaces().then((ws) => {
      setWorkspaces(ws);
      if (ws.length > 0 && !getWorkspace()) setWorkspace(ws[0]);
    });
  }, []);

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

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    const { workspace: ws } = await api.createWorkspace(newWsName.trim());
    setWorkspaces((w) => [...w, ws]);
    switchWorkspace(ws);
    setNewWsModal(false);
    setNewWsName('');
  };

  const renderNav = (isCollapsed = false, onNavigate) => (
    <>
      <NavGroup label="Workspace" collapsed={isCollapsed}>
        <NavItem href="/app" icon="sparkle" label="Analysis" exact collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/market" icon="bar" label="Market model" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/distribution" icon="trending" label="Distribution" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/competitors" icon="users" label="Competitors" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/compare" icon="grid" label="Compare" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/company" icon="map" label="Deep dive" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/moves" icon="zap" label="Next moves" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/changes" icon="activity" label="Changes" badge={unseen} collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/notifications" icon="bell" label="Alerts" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/reports" icon="share" label="History" collapsed={isCollapsed} onNavigate={onNavigate} />
      </NavGroup>

      <NavGroup label="Labs" collapsed={isCollapsed}>
        <NavItem href="/positioning" icon="sparkle" label="Positioning lab" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/pricing-lab" icon="card" label="Pricing simulator" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/gaps" icon="radar" label="Feature gaps" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/evidence" icon="check" label="Evidence" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/war-room" icon="shield" label="War room" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/win-loss" icon="trending" label="Win / loss" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/market-entry" icon="map" label="Market entry" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/investor" icon="bar" label="Investor one-pager" collapsed={isCollapsed} onNavigate={onNavigate} />
      </NavGroup>

      <NavGroup label="Account" collapsed={isCollapsed}>
        <NavItem href="/my-product" icon="card" label="My product" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/discover" icon="plus" label="Discover" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/methodology" icon="shield" label="Methodology" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/usage" icon="bar" label="Usage" collapsed={isCollapsed} onNavigate={onNavigate} />
        <NavItem href="/settings" icon="settings" label="Settings" collapsed={isCollapsed} onNavigate={onNavigate} />
      </NavGroup>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-ink-800 bg-ink-900/60 p-3 transition-all duration-200 md:flex ${collapsed ? 'w-16' : 'w-56'}`}>
        {/* Logo + collapse */}
        <div className={`mb-6 flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-1'}`}>
          {!collapsed && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
              <Icon name="radar" className="h-4 w-4" />
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 leading-tight">
              <div style={{ fontFamily: 'var(--font-brand)' }} className="text-sm font-semibold leading-tight text-white">Mira Vue</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-ink-800 hover:text-slate-300 transition ml-auto"
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-0.5">
          {renderNav(collapsed)}
        </nav>

        {/* Bottom: workspace + sign out */}
        <div className={`mt-4 space-y-2 border-t border-ink-800 pt-3 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
          {!collapsed && workspace && (
            <WorkspaceSwitcher
              workspace={workspace}
              workspaces={workspaces}
              onSwitch={switchWorkspace}
              onCreate={() => setNewWsModal(true)}
            />
          )}
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-600 hover:bg-ink-800 hover:text-slate-300 transition ${collapsed ? 'justify-center' : 'w-full'}`}
          >
            <Icon name="logout" className="h-3.5 w-3.5" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-ink-800 bg-ink-900/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
            <Icon name="radar" className="h-3.5 w-3.5" />
          </div>
          <span style={{ fontFamily: 'var(--font-brand)' }} className="text-sm font-semibold text-white">Mira Vue</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          className="relative flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-ink-600 hover:text-white"
        >
          <Icon name="list" className="h-4 w-4" />
          Menu
          {unseen > 0 && <span className="h-2 w-2 rounded-full bg-accent" aria-label={`${unseen} unseen changes`} />}
        </button>
      </header>

      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation" width="max-w-sm">
        <nav aria-label="Mobile primary navigation" className="flex max-h-[calc(100dvh-11rem)] flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
          {renderNav(false, () => setMobileOpen(false))}
        </nav>
        <div className="mt-5 space-y-3 border-t border-ink-700 pt-4">
          {workspace && (
            <WorkspaceSwitcher
              workspace={workspace}
              workspaces={workspaces}
              onSwitch={switchWorkspace}
              onCreate={() => { setMobileOpen(false); setNewWsModal(true); }}
            />
          )}
          <button type="button" onClick={handleSignOut} className="btn-ghost w-full">
            <Icon name="logout" className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </Modal>

      {/* New workspace modal */}
      <Modal open={newWsModal} onClose={() => setNewWsModal(false)} title="Create workspace" width="max-w-sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-workspace-name" className="label">Workspace name</label>
            <input
              id="new-workspace-name"
              className="input"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateWorkspace(); }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setNewWsModal(false)} className="btn-ghost">Cancel</button>
            <button type="button" onClick={handleCreateWorkspace} className="btn-primary">Create</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
