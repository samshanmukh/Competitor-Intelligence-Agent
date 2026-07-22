'use client';

import { useState } from 'react';
import { signInWithOAuth } from '../lib/auth';

/** Google/GitHub — one button each for both sign-in and sign-up. */
export default function OAuthButtons({ from }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  const go = async (provider) => {
    setLoading(provider);
    setError('');
    try {
      await signInWithOAuth(provider, { from });
    } catch (err) {
      setError(err.message || 'OAuth failed');
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => go('google')}
          disabled={!!loading}
          className="btn-ghost flex w-full items-center justify-center gap-2 py-2.5"
        >
          <GoogleIcon />
          {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={() => go('github')}
          disabled={!!loading}
          className="btn-ghost flex w-full items-center justify-center gap-2 py-2.5"
        >
          <GitHubIcon />
          {loading === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
        </button>
      </div>
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M5.3 14.3l-.8.6-2.5 2C3.5 20.1 7.4 22.5 12 22.5c2.7 0 5-0.9 6.6-2.4l-3.1-2.4c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3z" />
      <path fill="#4A90E2" d="M3.9 7.1C3.3 8.3 3 9.6 3 11s.3 2.7.9 3.9c0 .1 3.3-2.5 3.3-2.5-.2-.6-.3-1.2-.3-1.4 0-.5.1-1 .3-1.4L3.9 7.1z" />
      <path fill="#FBBC05" d="M12 5.5c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.5 14.7 1.5 12 1.5 7.4 1.5 3.5 3.9 2 7.1l3.2 2.5C6 7.3 8.3 5.5 12 5.5z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.85 0 1.7.12 2.5.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.58.69.48A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
