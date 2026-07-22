'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { Skeleton, EmptyState, timeAgo } from '../../../../components/ui';
import ReportView from '../../../../components/ReportView';
import BrandLogo from '../../../../components/BrandLogo';

export default function SharedReportPage() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { report: r } = await api.getSharedReport(token);
        setReport(r);
      } catch (err) {
        setError(err.message || 'Report not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-12">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24">
        <EmptyState icon="alert" title="Report unavailable">
          {error || 'This shared link is invalid or the report was deleted.'}
        </EmptyState>
        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link href="/" className="text-accent hover:text-ink transition">Back to Mira</Link>
        </p>
      </div>
    );
  }

  const c = report.content || {};

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-ink-800 bg-ink-900/80 px-5 py-4 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <BrandLogo href="/" height={28} />
          <span className="chip text-[10px] text-ink-soft">Shared report · read-only</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-10 pb-24">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{report.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Shared {timeAgo(report.created_at)} · {c.competitors?.length || 0} competitors
          </p>
          {report.expires_at && (
            <p className="mt-1 text-xs text-ink-faint">
              Link expires {new Date(report.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {c.competitors ? (
          <div className="card p-5">
            <ReportView
              competitors={c.competitors}
              matrix={c.matrix}
              positioning={c.positioning}
              reviews={c.reviews}
              take={c.take}
              market={c.market}
              product={c.product}
              strategy={c.strategy}
            />
          </div>
        ) : (
          <EmptyState icon="alert" title="Report data unavailable" />
        )}

        <p className="text-center text-sm text-ink-soft">
          Want your own competitive intelligence?{' '}
          <Link href="/signup" className="text-accent hover:text-ink transition">Get started free</Link>
        </p>
      </div>
    </div>
  );
}
