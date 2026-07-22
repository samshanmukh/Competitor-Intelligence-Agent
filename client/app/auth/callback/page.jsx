'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOAuthCallback } from '../../../lib/auth';

function CallbackHandler() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { returnTo } = await completeOAuthCallback();
        if (!cancelled) router.replace(returnTo || '/app');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not complete sign in.');
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950">
      <div className="text-center space-y-3">
        {error ? (
          <>
            <p className="text-sm text-rose-300">{error}</p>
            <a href="/oauth" className="text-sm text-accent-soft hover:text-white">Back to OAuth test</a>
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
