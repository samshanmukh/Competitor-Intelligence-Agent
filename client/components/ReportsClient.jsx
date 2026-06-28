'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon, Skeleton, EmptyState, timeAgo, useToast } from './ui';

export default function ReportsClient() {
  const [competitors, setCompetitors] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [positionReport, setPositionReport] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.listCompetitors('approved')
      .then(({ competitors }) => setCompetitors(competitors || []))
      .catch((err) => toast({ type: 'error', title: 'Failed to load', message: err.message }));
  }, []);

  const generatePositioning = async () => {
    setGenerating(true);
    try {
      const { analysis, competitors: comps } = await api.positioning();
      setPositionReport({ analysis, competitors: comps, generatedAt: new Date().toISOString() });
      toast({ type: 'success', title: 'Report generated' });
    } catch (err) {
      toast({ type: 'error', title: 'Generation failed', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ type: 'success', title: 'Copied to clipboard' });
  };

  const exportCSV = () => {
    if (!competitors?.length) return;
    const rows = [
      ['Name', 'Website', 'Pricing URL', 'Value Score', 'Last Checked', 'Change Count'],
      ...competitors.map((c) => [
        c.name, c.website || '', c.pricing_url || '', c.value_score || '',
        c.last_checked_at || '', c.changeCount || 0,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-intel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', title: 'CSV downloaded' });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Generate, export, and share competitive intelligence reports.</p>
      </div>

      {/* Export actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: 'download',
            label: 'Export CSV',
            desc: 'Competitor list with pricing data',
            action: exportCSV,
            disabled: !competitors?.length,
          },
          {
            icon: 'sparkle',
            label: 'Positioning Report',
            desc: 'AI-generated market analysis',
            action: generatePositioning,
            disabled: !competitors?.length || generating,
            loading: generating,
          },
          {
            icon: 'copy',
            label: 'Copy as Markdown',
            desc: 'Report as formatted markdown',
            action: () => positionReport && copyToClipboard(positionReport.analysis || ''),
            disabled: !positionReport,
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            disabled={item.disabled}
            className="card p-4 text-left hover:border-ink-600 transition disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-accent-soft group-hover:bg-accent/15 group-disabled:group-hover:bg-ink-800 transition">
              <Icon name={item.loading ? 'refresh' : item.icon} className={`h-4 w-4 ${item.loading ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-sm font-medium text-white">{item.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
          </button>
        ))}
      </div>

      {/* Positioning report */}
      {positionReport && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Market Positioning Report</h2>
              <p className="text-xs text-slate-500">Generated {timeAgo(positionReport.generatedAt)} · {positionReport.competitors?.length || 0} competitors</p>
            </div>
            <button
              onClick={() => copyToClipboard(positionReport.analysis || '')}
              className="btn-ghost py-1 px-2 text-xs"
            >
              <Icon name="copy" className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <div className="space-y-1">
            {(positionReport.analysis || '').split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <h3 key={i} className="mt-4 mb-1 text-sm font-semibold text-slate-200">{line.slice(2, -2)}</h3>;
              }
              if (line.startsWith('# ')) {
                return <h2 key={i} className="mt-4 mb-1 text-base font-semibold text-white">{line.slice(2)}</h2>;
              }
              if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 text-sm text-slate-400 list-disc">{line.slice(2)}</li>;
              }
              return line ? <p key={i} className="text-sm text-slate-400 leading-relaxed">{line}</p> : <br key={i} />;
            })}
          </div>
        </div>
      )}

      {/* Competitors summary */}
      {competitors === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : competitors.length === 0 ? (
        <EmptyState icon="share" title="No competitors to report on">
          Add and approve competitors first, then come back to generate reports.
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-ink-700 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Competitor Summary</h2>
            <button onClick={exportCSV} className="btn-ghost py-1 px-2 text-xs">
              <Icon name="download" className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Competitor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 hidden md:table-cell">Value Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Changes</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 hidden lg:table-cell">Pricing URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {competitors.map((c) => (
                <tr key={c.id} className="hover:bg-ink-850/30 transition">
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {c.value_score != null
                      ? <span className="tabular-nums text-emerald-400">{c.value_score}/10</span>
                      : <span className="text-slate-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.changeCount || 0}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.pricing_url && (
                      <a href={c.pricing_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-accent-soft hover:text-white transition truncate block max-w-48">
                        {c.pricing_url}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
