'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState(null);
  const [marking, setMarking] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.listFeatureNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load notifications', message: err.message });
      setNotifications([]);
    }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await api.markFeatureNotificationsRead();
      setNotifications((items) => (items || []).map((item) => ({ ...item, read: true })));
      toast({ type: 'success', title: 'Notifications marked read' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not mark read', message: err.message });
    } finally {
      setMarking(false);
    }
  };

  const unread = (notifications || []).filter((n) => !n.read).length;

  return (
    <LabShell
      title="Alerts"
      subtitle="A focused inbox for generated briefs, alerts, and feature lab updates."
      action={<button onClick={markAllRead} disabled={marking || !unread} className="btn-primary text-sm">
        <Icon name={marking ? 'refresh' : 'check'} className={`h-4 w-4 ${marking ? 'animate-spin' : ''}`} />
        Mark all read
      </button>}
    >
      {notifications === null ? (
        <LabPanel><LabShimmerBlock rows={3} /></LabPanel>
      ) : notifications.length === 0 ? (
        <EmptyState icon="bell" title="No notifications yet">Generated briefs and lab events will show up here.</EmptyState>
      ) : (
        <section className="space-y-2">
          {notifications.map((item) => (
            <a
              key={item.id}
              href={item.url || '#'}
              className={`block transition hover:opacity-90 ${item.read ? 'opacity-70' : ''}`}
            >
              <LabPanel className="!p-4">
                <div className="flex items-start gap-3">
                  <div aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? 'bg-ink-700' : 'bg-accent-soft'}`} />
                  <div className="min-w-0 flex-1">
                    <span className="sr-only">{item.read ? 'Read' : 'Unread'} alert. </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">{item.title || 'Notification'}</h2>
                      {item.type && <span className="chip border-ink-700 bg-ink-850 text-[10px] text-slate-400">{item.type}</span>}
                    </div>
                    {item.body && <p className="mt-1 text-sm text-slate-400">{item.body}</p>}
                    {item.at && <p className="mt-2 text-xs text-slate-600">{new Date(item.at).toLocaleString()}</p>}
                  </div>
                </div>
              </LabPanel>
            </a>
          ))}
        </section>
      )}
    </LabShell>
  );
}
