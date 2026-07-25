'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CompanyLogo, EmptyState, Icon, ImpactBadge, Skeleton, TabBar, ValueScore, timeAgo, useToast, ConfirmDialog } from './ui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CompetitorDetailClient({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [battlecard, setBattlecard] = useState(null);
  const [loadingBattlecard, setLoadingBattlecard] = useState(false);
  const [priceHistory, setPriceHistory] = useState(null);
  const [tab, setTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const load = async () => {
    try {
      setData(await api.getCompetitor(id));
    } catch (err) {
      toast({ type: 'error', title: 'Failed to load', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (tab === 'pricing') {
      api.priceHistory(id)
        .then(({ history }) => setPriceHistory(history || []))
        .catch(() => setPriceHistory([]));
    }
  }, [tab, id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { result } = await api.refreshOne(id);
      const map = {
        changed: { type: 'success', title: 'Change detected', message: result.summary },
        unchanged: { type: 'info', title: 'No change', message: 'Identical to last snapshot.' },
        first_snapshot: { type: 'success', title: 'Baseline captured' },
        error: { type: 'error', title: 'Fetch failed', message: result.error },
      };
      toast(map[result.status] || { title: 'Done' });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Refresh failed', message: err.message });
    } finally {
      setRefreshing(false);
    }
  };

  const runValueScore = async () => {
    setScoring(true);
    try {
      const { score, reasoning } = await api.valueScore(id);
      toast({ type: 'success', title: `Value score: ${score}/10` });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Scoring failed', message: err.message });
    } finally {
      setScoring(false);
    }
  };

  const loadBattlecard = async () => {
    setLoadingBattlecard(true);
    try {
      const { battlecard: bc } = await api.battlecard(id);
      setBattlecard(bc);
    } catch (err) {
      toast({ type: 'error', title: 'Battlecard failed', message: err.message });
    } finally {
      setLoadingBattlecard(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteCompetitor(id);
      toast({ type: 'success', title: 'Removed' });
      router.push('/competitors');
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove', message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!data) return null;

  const { competitor, latestSnapshot, changes } = data;
  const parsedChanges = (changes || []).map((c) => {
    try { return { ...c, analysis: typeof c.analysis === 'string' ? JSON.parse(c.analysis) : c.analysis }; }
    catch { return c; }
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'radar' },
    { id: 'pricing', label: 'Price History', icon: 'trending' },
    { id: 'snapshot', label: 'Snapshot', icon: 'clock' },
    { id: 'changes', label: `Changes (${parsedChanges.length})`, icon: 'activity' },
    { id: 'battlecard', label: 'Battlecard', icon: 'shield' },
  ];

  // Build chart data from price history
  const chartData = (priceHistory || []).map((h) => ({
    date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...Object.fromEntries((h.tiers || []).map((t) => [t.name, t.price_monthly])),
  })).reverse();

  const tierNames = [...new Set((priceHistory || []).flatMap((h) => (h.tiers || []).map((t) => t.name)))];
  const COLORS = ['#6366f1', '#34d399', '#f59e0b', '#f87171', '#a78bfa'];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link href="/competitors" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition">
        <Icon name="chevronLeft" className="h-4 w-4" /> Competitors
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <CompanyLogo
            name={competitor.name}
            website={competitor.website}
            pricing_url={competitor.pricing_url}
            className="h-12 w-12 rounded-xl"
            textClassName="text-lg"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">{competitor.name}</h1>
            <a href={competitor.pricing_url} target="_blank" rel="noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm text-accent-soft hover:underline">
              <span className="min-w-0 truncate sm:whitespace-normal sm:break-all">
                {/apps\.apple\.com/i.test(competitor.pricing_url || '')
                  ? 'App Store'
                  : /play\.google\.com\/store\/apps/i.test(competitor.pricing_url || '')
                    ? 'Play Store'
                    : competitor.pricing_url}
              </span>
              <Icon name="external" className="h-3.5 w-3.5 shrink-0" />
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>Checked {timeAgo(competitor.last_checked_at)}</span>
              {competitor.last_changed_at && <span>Changed {timeAgo(competitor.last_changed_at)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn-primary">
            <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={() => setConfirmDelete(true)} className="btn-danger px-2.5">
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {competitor.last_error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Last fetch failed</div>
            <div className="mt-0.5 text-rose-400/80 text-xs">{competitor.last_error}</div>
          </div>
        </div>
      )}

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4 text-center space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Value Score</p>
              <p className="text-2xl font-bold"><ValueScore score={competitor.value_score} /></p>
              <button
                onClick={runValueScore}
                disabled={scoring}
                className="text-xs text-accent-soft hover:text-white transition"
              >
                {scoring ? 'Scoring…' : competitor.value_score ? 'Re-score' : 'Run AI score'}
              </button>
            </div>
            <div className="card p-4 text-center space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Changes</p>
              <p className="text-2xl font-bold text-white">{parsedChanges.length}</p>
              <p className="text-xs text-slate-600">pricing events detected</p>
            </div>
            <div className="card p-4 text-center space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Snapshots</p>
              <p className="text-2xl font-bold text-white">{data.snapshots?.length || 0}</p>
              <p className="text-xs text-slate-600">content captures</p>
            </div>
          </div>

          {competitor.value_analysis && (
            <div className="card p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Value Analysis</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{competitor.value_analysis}</p>
            </div>
          )}

          {competitor.description && (
            <div className="card p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{competitor.description}</p>
            </div>
          )}

          {parsedChanges.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Changes</h3>
              {parsedChanges.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <ImpactBadge impact={c.analysis?.impact} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300">{c.analysis?.summary || 'Pricing updated'}</p>
                    <p className="text-xs text-slate-600">{timeAgo(c.detected_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Price History Chart */}
      {tab === 'pricing' && (
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">Price History</h2>
          {priceHistory === null ? (
            <div className="h-64 flex items-center justify-center">
              <Icon name="refresh" className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : chartData.length < 2 ? (
            <EmptyState icon="trending" title="Not enough history">
              At least 2 snapshots are needed to chart price changes over time.
            </EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#181c24" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0e1014', border: '1px solid #181c24', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v) => [`$${v}/mo`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {tierNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2} dot={{ r: 3, fill: COLORS[i % COLORS.length] }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Snapshot */}
      {tab === 'snapshot' && (
        latestSnapshot ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 flex items-center gap-2">
              Captured {timeAgo(latestSnapshot.fetched_at)}
              {latestSnapshot.source && latestSnapshot.source !== 'youcom' && (
                <span className="chip border-ink-700 bg-ink-850 text-slate-400 text-[10px]">via {latestSnapshot.source}</span>
              )}
            </p>
            <pre className="card max-h-[600px] overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-slate-300">
              {latestSnapshot.content}
            </pre>
          </div>
        ) : (
          <EmptyState icon="clock" title="No snapshot yet" action={
            <button onClick={refresh} className="btn-primary"><Icon name="refresh" /> Fetch now</button>
          }>
            Hit refresh to capture the first baseline snapshot.
          </EmptyState>
        )
      )}

      {/* Changes */}
      {tab === 'changes' && (
        parsedChanges.length === 0 ? (
          <EmptyState icon="bell" title="No changes recorded">
            The first refresh captures a baseline. Changes appear here on subsequent refreshes.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {parsedChanges.map((ch) => (
              <DiffCard key={ch.id} change={ch} />
            ))}
          </div>
        )
      )}

      {/* Battlecard */}
      {tab === 'battlecard' && (
        <div className="space-y-4">
          {!battlecard && (
            <div className="card p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent-soft">
                <Icon name="shield" className="h-6 w-6" />
              </div>
              <h2 className="font-semibold text-white">Generate Battlecard</h2>
              <p className="text-sm text-slate-400">
                AI-generated sales battlecard with strengths, weaknesses, how to win, and objection handling.
              </p>
              <button onClick={loadBattlecard} disabled={loadingBattlecard || !latestSnapshot} className="btn-primary">
                {loadingBattlecard
                  ? <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Generating…</>
                  : <><Icon name="sparkle" className="h-4 w-4" /> Generate</>
                }
              </button>
              {!latestSnapshot && <p className="text-xs text-slate-600">Refresh to capture a snapshot first.</p>}
            </div>
          )}

          {battlecard && (
            <div className="space-y-4">
              {battlecard.elevator_pitch && (
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                  <p className="text-sm font-medium text-accent-soft">"{battlecard.elevator_pitch}"</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Their Strengths', items: battlecard.strengths, color: 'rose' },
                  { label: 'Their Weaknesses', items: battlecard.weaknesses, color: 'emerald' },
                  { label: 'How to Win', items: battlecard.how_to_win, color: 'accent' },
                ].map(({ label, items, color }) => items?.length ? (
                  <div key={label} className="card p-4 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className={`flex items-start gap-2 text-sm ${
                          color === 'rose' ? 'text-rose-300' : color === 'emerald' ? 'text-emerald-300' : 'text-slate-300'
                        }`}>
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null)}
              </div>
              {battlecard.common_objections?.length > 0 && (
                <div className="card p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Common Objections</h3>
                  {battlecard.common_objections.map((obj, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-medium text-slate-400">"{obj.objection}"</p>
                      <p className="text-sm text-slate-300 pl-2 border-l border-accent/30">{obj.response}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={loadBattlecard} disabled={loadingBattlecard} className="btn-ghost text-xs">
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete competitor"
        message={`Remove ${competitor.name} and all its history? This cannot be undone.`}
        danger
      />
    </div>
  );
}

function DiffCard({ change }) {
  const [showDiff, setShowDiff] = useState(false);
  const a = change.analysis || {};
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {a.impact && <ImpactBadge impact={a.impact} />}
          <span className="text-xs text-slate-500">{timeAgo(change.detected_at)}</span>
        </div>
        {change.diff && (
          <button onClick={() => setShowDiff((s) => !s)} className="text-xs text-accent-soft hover:text-white transition">
            {showDiff ? 'Hide diff' : 'View diff'}
          </button>
        )}
      </div>
      {a.summary && <p className="text-sm text-white">{a.summary}</p>}
      {a.details && <p className="text-sm text-slate-400">{a.details}</p>}
      {showDiff && change.diff && (
        <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-ink-800 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed">
          {change.diff.split('\n').map((line, i) => (
            <div key={i} className={
              line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400' :
              line.startsWith('-') && !line.startsWith('---') ? 'text-rose-400' :
              line.startsWith('@@') ? 'text-accent-soft' : 'text-slate-500'
            }>{line || ' '}</div>
          ))}
        </pre>
      )}
    </div>
  );
}
