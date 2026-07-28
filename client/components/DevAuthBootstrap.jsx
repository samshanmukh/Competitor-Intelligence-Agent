'use client';

import { useEffect, useState } from 'react';
import { DEV_BYPASS_TOKEN } from '../lib/authBypass';

/**
 * When AUTH_BYPASS is on for localhost, seed localStorage with a dev session
 * so API calls send Bearer dev-bypass (middleware alone only sets the cookie).
 */
export default function DevAuthBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      if (!isLocal) {
        setReady(true);
        return;
      }

      // Only hit the endpoint when we look like we need a bypass session.
      const existing = localStorage.getItem('cia_token');
      if (existing && existing !== DEV_BYPASS_TOKEN && localStorage.getItem('cia_workspace')) {
        setReady(true);
        return;
      }

      try {
        const res = await fetch('/api/dev/session', { cache: 'no-store' });
        if (!res.ok) {
          setReady(true);
          return;
        }
        const data = await res.json();
        if (cancelled || !data?.token) {
          setReady(true);
          return;
        }
        localStorage.setItem('cia_token', data.token);
        document.cookie = `cia_auth=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        if (data.workspace) {
          localStorage.setItem('cia_workspace', JSON.stringify(data.workspace));
          document.cookie = `cia_workspace_id=${data.workspace.id}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
      } catch {
        /* API may still be starting, pages can retry */
      }
      if (!cancelled) setReady(true);
    }

    boot();
    return () => { cancelled = true; };
  }, []);

  // Don't block paint; bootstrap runs in the background.
  if (!ready) return null;
  return null;
}
