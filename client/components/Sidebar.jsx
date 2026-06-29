'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace, fetchWorkspaces, signOut, switchWorkspace } from '../lib/auth';
import { Icon, NotificationBell, WorkspaceSwitcher, Modal } from './ui';

function NavItem({ href, icon, label, badge, exact = false, collapsed = false }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
        isActive
          ? 'bg-ink-800 text-white'
          : 'text-slate-400 hover:bg-ink-800/70 hover:text-slate-200'
      } ${collapsed ? 'justify-center' : ''}`}
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

  const nav = (
    <>
      <NavGroup label="Workspace" collapsed={collapsed}>
        <NavItem href="/app" icon="sparkle" label="Analysis" exact collapsed={collapsed} />
        <NavItem href="/competitors" icon="users" label="Competitors" collapsed={collapsed} />
        <NavItem href="/changes" icon="bell" label="Changes" badge={unseen} collapsed={collapsed} />
        <NavItem href="/reports" icon="share" label="History" collapsed={collapsed} />
      </NavGroup>

      <NavGroup label="Account" collapsed={collapsed}>
        <NavItem href="/settings" icon="settings" label="Settings" collapsed={collapsed} />
      </NavGroup>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-800 bg-ink-900/60 p-3 md:flex transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
        {/* Logo + collapse */}
        <div className={`mb-6 flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-1'}`}>
          {!collapsed && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
              <Icon name="radar" className="h-4 w-4" />
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 leading-tight">
              <div className="text-sm font-semibold leading-tight text-white">Competitor Intelligence Agent</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-ink-800 hover:text-slate-300 transition ml-auto"
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="flex flex-col gap-4 flex-1">
          {nav}
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
      <div className="flex items-center gap-1 border-b border-ink-800 bg-ink-900/80 px-3 py-2 md:hidden backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2 mr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
            <Icon name="radar" className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-white">Competitor Intelligence Agent</span>
        </div>
        <NavItem href="/app" icon="sparkle" label="Analysis" exact />
        <NavItem href="/competitors" icon="users" label="Competitors" />
        <NavItem href="/changes" icon="bell" label="Changes" badge={unseen} />
        <NavItem href="/reports" icon="share" label="History" />
        <NavItem href="/settings" icon="settings" label="Settings" />
      </div>

      {/* New workspace modal */}
      <Modal open={newWsModal} onClose={() => setNewWsModal(false)} title="Create workspace" width="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="label">Workspace name</label>
            <input
              className="input"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateWorkspace(); }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setNewWsModal(false)} className="btn-ghost">Cancel</button>
            <button onClick={handleCreateWorkspace} className="btn-primary">Create</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
