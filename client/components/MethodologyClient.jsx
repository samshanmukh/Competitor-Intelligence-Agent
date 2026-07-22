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
      <Link href="/market" className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink-soft">
        <Icon name="chevronLeft" className="h-3.5 w-3.5" /> Back to market model
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> Loading…</div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-ink">{doc?.title || 'Methodology'}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            How Mira AI estimates competitor market presence — and what it is not.
          </p>

          <div className="mt-8 space-y-6">
            {(doc?.sections || []).map((section, i) => (
              <section key={i} className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <h2 className="text-sm font-semibold text-ink">{section.heading}</h2>
                {section.body && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{section.body}</p>}
                {section.bullets?.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2"><span className="text-accent">•</span>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm text-ink-soft">
            Presence estimates appear on the{' '}
            <Link href="/distribution" className="text-accent underline">Distribution</Link> page and{' '}
            <Link href="/market" className="text-accent underline">Market model</Link> once you run market intelligence.
          </div>
        </>
      )}
    </div>
  );
}
