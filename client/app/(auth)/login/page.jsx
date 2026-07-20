'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, verifyEmailCode, resendCode, safeReturnPath, rememberReturnPath } from '../../../lib/auth';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get('from'));
  const signupHref = returnTo === '/app' ? '/signup' : `/signup?from=${encodeURIComponent(returnTo)}`;

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Inline verification state (shown only if the account needs verifying).
  const [needsVerify, setNeedsVerify] = useState(false);
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn({ email: form.email, password: form.password });
      rememberReturnPath(null);
      router.push(returnTo);
    } catch (err) {
      // If the account exists but isn't verified, switch to inline code entry.
      if (/verif/i.test(err.message)) {
        setNeedsVerify(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await verifyEmailCode({ email: form.email, otp: otp.trim() });
      rememberReturnPath(null);
      router.push(returnTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    setResentMsg('');
    try {
      await resendCode(form.email);
      setResentMsg('A new code was sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  if (needsVerify) {
    return (
      <form onSubmit={verify} className="card space-y-4 p-6">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-white">Verify your email</h2>
          <p className="text-sm text-slate-400">
            Enter the 6-digit code sent to <strong className="text-slate-200">{form.email}</strong>
          </p>
        </div>
        <input
          className="input text-center text-lg tracking-[0.4em] font-mono"
          aria-label="Verification code"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          autoFocus
          inputMode="numeric"
        />
        {resentMsg && (
          <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">{resentMsg}</p>
        )}
        {error && (
          <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}
        <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>
        <div className="flex items-center justify-between text-xs">
          <button type="button" onClick={() => { setNeedsVerify(false); setOtp(''); setError(''); }} className="text-slate-500 hover:text-slate-300 transition">
            ← Back
          </button>
          <button type="button" onClick={resend} disabled={resending} className="text-slate-500 hover:text-slate-300 transition">
            {resending ? 'Resending…' : 'Resend code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label htmlFor="login-email" className="label">Email</label>
          <input id="login-email" type="email" className="input" value={form.email} onChange={set('email')} placeholder="you@company.com" required autoFocus />
        </div>
        <div>
          <label htmlFor="login-password" className="label">Password</label>
          <input id="login-password" type="password" className="input" value={form.password} onChange={set('password')} placeholder="••••••••" required />
        </div>
        {error && (
          <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        No account?{' '}
        <Link href={signupHref} className="text-accent-soft hover:text-white transition">Create one</Link>
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
