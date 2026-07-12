'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { Icon, Spinner } from './ui';

export default function MethodologyClient() {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.methodology()
      .then((r) => setDoc(r.methodology))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/market" className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
        <Icon name="chevronLeft" className="h-3.5 w-3.5" /> Back to market model
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Loading…</div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white">{doc?.title || 'Methodology'}</h1>
          <p className="mt-2 text-sm text-slate-400">
            How Mira Vue estimates competitor market presence — and what it is not.
          </p>

          <div className="mt-8 space-y-6">
            {(doc?.sections || []).map((section, i) => (
              <section key={i} className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <h2 className="text-sm font-semibold text-white">{section.heading}</h2>
                {section.body && <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.body}</p>}
                {section.bullets?.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2"><span className="text-accent-soft">•</span>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm text-slate-300">
            Presence estimates appear on the{' '}
            <Link href="/distribution" className="text-accent-soft underline">Distribution</Link> page and{' '}
            <Link href="/market" className="text-accent-soft underline">Market model</Link> once you run market intelligence.
          </div>
        </>
      )}
    </div>
  );
}
