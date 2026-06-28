'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, signIn } from '../../../lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signUp({ email: form.email, password: form.password, name: form.name });
      if (result?.requireEmailVerification) {
        // Code-based verification — route to the verify page to enter the 6-digit code.
        router.push(`/verify?email=${encodeURIComponent(form.email)}`);
      } else {
        // Auto sign-in if email verification not required
        await signIn({ email: form.email, password: form.password });
        router.push('/');
      }
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
          <label className="label">Name</label>
          <input
            type="text"
            className="input"
            value={form.name}
            onChange={set('name')}
            placeholder="Your name"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={set('email')}
            placeholder="you@company.com"
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
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
          <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-accent-soft hover:text-white transition">
          Sign in
        </Link>
      </p>
    </div>
  );
}
