'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signInWithOAuth } from '../../../lib/auth';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn({ email: form.email, password: form.password });
      router.push(from);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={set('email')}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="relative flex items-center">
        <div className="flex-grow border-t border-ink-700" />
        <span className="mx-3 text-xs text-slate-600">or</span>
        <div className="flex-grow border-t border-ink-700" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => signInWithOAuth('github')} className="btn-ghost justify-center">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.4.6.1.83-.26.83-.57v-2c-3.34.73-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23A11.5 11.5 0 0 1 12 5.8c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.3c0 .32.22.68.83.57C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          GitHub
        </button>
        <button onClick={() => signInWithOAuth('google')} className="btn-ghost justify-center">
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path fill="#4285F4" d="M23.7 12.3c0-.8-.07-1.6-.2-2.3H12v4.4h6.6a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"/>
            <path fill="#34A853" d="M12 24c3.3 0 6.1-1.1 8.1-3l-3.9-3a7.5 7.5 0 0 1-11.2-3.9H1v3.1C3 21.3 7.3 24 12 24z"/>
            <path fill="#FBBC05" d="M5 14.1A7.5 7.5 0 0 1 5 9.9V6.8H1a12 12 0 0 0 0 10.4L5 14.1z"/>
            <path fill="#EA4335" d="M12 4.8a6.7 6.7 0 0 1 4.7 1.8l3.5-3.5A11.9 11.9 0 0 0 12 0C7.3 0 3 2.7 1 6.8l4 3.1A7.5 7.5 0 0 1 12 4.8z"/>
          </svg>
          Google
        </button>
      </div>

      <p className="text-center text-sm text-slate-500">
        No account?{' '}
        <Link href="/signup" className="text-accent-soft hover:text-white transition">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-6 h-64 animate-pulse bg-ink-800" />}>
      <LoginForm />
    </Suspense>
  );
}
