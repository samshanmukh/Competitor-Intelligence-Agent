'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@insforge/sdk';
import { signIn } from '../../../lib/auth';

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const insforge = createClient({
    baseUrl: 'https://tpq6mvqe.us-east.insforge.app',
    anonKey: 'anon_b6023a1adec5472cfe335ee7fec1139a85bd05a43a2f0513e2eba963c4a71d1f',
  });

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await insforge.auth.verifyEmail({ email, otp: otp.trim() });
      if (error) throw new Error(error.message || 'Invalid code');
      if (data?.accessToken) {
        localStorage.setItem('cia_token', data.accessToken);
        document.cookie = `cia_auth=${data.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        const res = await fetch('/api/auth/ensure-workspace', {
          method: 'POST', headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (res.ok) {
          const { workspace } = await res.json();
          localStorage.setItem('cia_workspace', JSON.stringify(workspace));
          document.cookie = `cia_workspace_id=${workspace.id}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        router.push('/');
      } else if (password) {
        await signIn({ email, password });
        router.push('/');
      } else {
        router.push('/login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    try {
      await insforge.auth.resendVerificationEmail({ email });
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
        <p className="text-sm text-slate-400">Enter the 6-digit code sent to <strong className="text-slate-200">{email}</strong></p>
      </div>

      <div>
        <label className="label">Verification code</label>
        <input
          className="input text-center text-lg tracking-[0.4em] font-mono"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          autoFocus
          inputMode="numeric"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}

      <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
        {loading ? 'Verifying…' : 'Verify & continue'}
      </button>

      <button type="button" onClick={resend} disabled={resending} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition">
        {resending ? 'Resending…' : "Didn't get a code? Resend"}
      </button>
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
