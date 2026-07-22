'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

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
        {marking ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
        Mark all read
      </button>}
    >
      {notifications === null ? (
        <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : notifications.length === 0 ? (
        <EmptyState icon="bell" title="No notifications yet">Generated briefs and lab events will show up here.</EmptyState>
      ) : (
        <section className="space-y-2">
          {notifications.map((item) => (
            <a
              key={item.id}
              href={item.url || '#'}
              className={`card block p-4 transition hover:border-ink-600 ${item.read ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? 'bg-ink-700' : 'bg-accent-soft'}`} />
                <div className="min-w-0 flex-1">
                  <span className="sr-only">{item.read ? 'Read' : 'Unread'} alert. </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-ink">{item.title || 'Notification'}</h2>
                    {item.type && <span className="chip border-ink-700 bg-ink-850 text-[10px] text-ink-soft">{item.type}</span>}
                  </div>
                  {item.body && <p className="mt-1 text-sm text-ink-soft">{item.body}</p>}
                  {item.at && <p className="mt-2 text-xs text-ink-faint">{new Date(item.at).toLocaleString()}</p>}
                </div>
              </div>
            </a>
          ))}
        </section>
      )}
    </LabShell>
  );
}
