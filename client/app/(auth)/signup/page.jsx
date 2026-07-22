'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUp, signIn, safeReturnPath, rememberReturnPath } from '../../../lib/auth';
import OAuthButtons from '../../../components/OAuthButtons';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get('from'));
  const loginHref = returnTo === '/app' ? '/login' : `/login?from=${encodeURIComponent(returnTo)}`;
  const oauthError = params.get('oauth_error') || '';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(oauthError);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signUp({ email: form.email, password: form.password, name: form.name });
      if (result?.accessToken) {
        // Verification disabled → session issued at signup → go straight in.
        rememberReturnPath(null);
        router.push(returnTo);
      } else if (result?.requireEmailVerification) {
        // Verification still required → enter the 6-digit code.
        rememberReturnPath(returnTo);
        const fromParam = returnTo === '/app' ? '' : `&from=${encodeURIComponent(returnTo)}`;
        router.push(`/verify?email=${encodeURIComponent(form.email)}${fromParam}`);
      } else {
        // Fallback: try an immediate sign-in.
        await signIn({ email: form.email, password: form.password });
        rememberReturnPath(null);
        router.push(returnTo);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-6">
        <OAuthButtons from={returnTo} />

        <div className="flex items-center gap-3 text-xs text-ink-faint">
          <div className="h-px flex-1 bg-ink-700" />
          <span>or</span>
          <div className="h-px flex-1 bg-ink-700" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="signup-name" className="label">Name</label>
            <input
              id="signup-name"
              type="text"
              className="input"
              value={form.name}
              onChange={set('name')}
              placeholder="Your name"
              minLength={2}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="label">Email</label>
            <input
              id="signup-email"
              type="email"
              className="input"
              value={form.email}
              onChange={set('email')}
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="label">Password</label>
            <input
              id="signup-password"
              type="password"
              className="input"
              value={form.password}
              onChange={set('password')}
              placeholder="Min. 8 characters"
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href={loginHref} className="text-accent hover:text-ink transition">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse bg-ink-800 p-6" />}>
      <SignupForm />
    </Suspense>
  );
}
