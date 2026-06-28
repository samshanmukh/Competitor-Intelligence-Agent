'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Spinner, useToast } from './ui';
import { ChangeFeed } from './DashboardClient';

export default function ChangesClient() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const { changes } = await api.changes(100);
        setChanges(changes);
        await api.markSeen();
      } catch (err) {
        toast({ type: 'error', title: 'Failed to load', message: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Spinner /> <span className="ml-2 text-sm">Loading changes…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Change Feed</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every detected pricing change across your tracked competitors.
        </p>
      </header>
      <ChangeFeed changes={changes} />
    </div>
  );
}
