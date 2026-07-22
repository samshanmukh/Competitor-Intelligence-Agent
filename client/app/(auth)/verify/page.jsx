'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyEmailCode, resendCode, rememberReturnPath, safeReturnPath } from '../../../lib/auth';

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get('from'));
  const loginHref = returnTo === '/app' ? '/login' : `/login?from=${encodeURIComponent(returnTo)}`;

  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resentMsg, setResentMsg] = useState('');

  const verify = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email first.'); return; }
    setLoading(true);
    setError('');
    try {
      await verifyEmailCode({ email: email.trim(), otp: otp.trim() });
      rememberReturnPath(null);
      router.push(returnTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim()) { setError('Enter your email to receive a code.'); return; }
    setResending(true);
    setError('');
    setResentMsg('');
    try {
      await resendCode(email.trim());
      setResentMsg(`A new code was sent to ${email.trim()}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={verify} className="card space-y-4 p-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-white">Verify your email</h2>
        <p className="text-sm text-slate-400">Enter the 6-digit code we emailed you.</p>
      </div>

      <div>
        <label htmlFor="verify-email" className="label">Email</label>
        <input
          id="verify-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoFocus={!email}
          required
        />
      </div>

      <div>
        <label htmlFor="verify-code" className="label">Verification code</label>
        <input
          id="verify-code"
          className="input text-center text-lg tracking-[0.4em] font-mono"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          autoFocus={!!email}
          inputMode="numeric"
        />
      </div>

      {resentMsg && (
        <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">{resentMsg}</p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}

      <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
        {loading ? 'Verifying…' : 'Verify & continue'}
      </button>

      <button type="button" onClick={resend} disabled={resending} className="btn-ghost w-full justify-center">
        {resending ? 'Sending…' : 'Resend code to email'}
      </button>

      <p className="text-center text-xs text-slate-500">
        <Link href={loginHref} className="text-accent-soft hover:text-white transition">Back to sign in</Link>
      </p>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="card p-6 h-64 animate-pulse bg-ink-800" />}>
      <VerifyForm />
    </Suspense>
  );
}
