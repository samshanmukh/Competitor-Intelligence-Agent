'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@insforge/sdk';

function CallbackHandler() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
        if (!baseUrl || !anonKey) {
          throw new Error('Authentication is not configured. Contact the workspace administrator.');
        }
        const insforge = createClient({
          baseUrl,
          anonKey,
        });

        // The SDK auto-detects the `insforge_code` in the URL and exchanges it for a
        // session. getCurrentUser() ensures the exchange/refresh has completed.
        const { data, error } = await insforge.auth.getCurrentUser();
        if (error || !data?.user) {
          throw new Error('Could not complete sign in. Please try again.');
        }

        // After the session is established, the access token is held in memory.
        let token = insforge.auth.getAccessToken?.();
        if (!token) {
          const session = await insforge.auth.getSession?.();
          token = session?.accessToken || session?.data?.accessToken;
        }
        if (!token) throw new Error('No session token found after OAuth.');

        localStorage.setItem('cia_token', token);
        document.cookie = `cia_auth=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

        // Ensure a workspace exists for this user.
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/auth/ensure-workspace`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { workspace } = await res.json();
          localStorage.setItem('cia_workspace', JSON.stringify(workspace));
          document.cookie = `cia_workspace_id=${workspace.id}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        router.push('/app');
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950">
      <div className="text-center space-y-3">
        {error ? (
          <>
            <p className="text-sm text-rose-300">{error}</p>
            <a href="/login" className="text-sm text-accent-soft hover:text-white">Back to login</a>
          </>
        ) : (
          <>
            <div className="mx-auto spinner h-8 w-8" />
            <p className="text-sm text-slate-400">Completing sign in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ink-950"><div className="spinner h-8 w-8" /></div>}>
      <CallbackHandler />
    </Suspense>
  );
}
