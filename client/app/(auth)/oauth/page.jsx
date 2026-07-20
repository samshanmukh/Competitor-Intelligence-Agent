'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { safeReturnPath } from '../../../lib/auth';
import OAuthButtons from '../../../components/OAuthButtons';

function OAuthTestForm() {
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get('from'));
  const oauthError = params.get('oauth_error') || '';

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">OAuth test</h2>
          <p className="text-sm text-slate-400">
            Temporary page for testing first-party Google/GitHub sign-in. Not linked from login or signup.
          </p>
        </div>

        {oauthError && (
          <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            {oauthError}
          </p>
        )}

        <OAuthButtons mode="signin" from={returnTo} />
      </div>

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-accent-soft hover:text-white transition">← Back to email login</Link>
      </p>
    </div>
  );
}

export default function OAuthTestPage() {
  return (
    <Suspense fallback={<div className="card h-48 animate-pulse bg-ink-800 p-6" />}>
      <OAuthTestForm />
    </Suspense>
  );
}
