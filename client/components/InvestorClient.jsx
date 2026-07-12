'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, Skeleton, Spinner, useToast } from './ui';
import { LabShell } from './labs/LabShell';

export default function InvestorClient() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getInvestorOnepager();
        setResult(res.result || null);
      } catch (err) {
        toast({ type: 'error', title: 'Could not load one-pager', message: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateInvestorOnepager();
      setResult(res.result || null);
      toast({ type: 'success', title: 'One-pager ready' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not generate one-pager', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    const markdown = result?.markdown || toMarkdown(result);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ type: 'success', title: 'Markdown copied' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not copy', message: err.message });
    }
  };

  return (
    <LabShell
      title="Investor One-Pager"
      subtitle="Convert competitive context into a crisp fundraising memo."
      action={<div className="flex gap-2">
        {result && <button onClick={copy} className="btn-ghost text-sm"><Icon name="copy" className="h-4 w-4" />{copied ? 'Copied' : 'Copy markdown'}</button>}
        <button onClick={generate} disabled={generating} className="btn-primary text-sm">
          {generating ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>}
    >
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-72" /></div>
      ) : !result ? (
        <EmptyState icon="bar" title="No investor memo yet" action={<button onClick={generate} className="btn-primary">Generate one-pager</button>}>
          Create a first draft from your product, competitors, and market signals.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <section className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headline</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{result.headline}</h2>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <MemoBlock title="Problem" body={result.problem} />
            <MemoBlock title="Solution" body={result.solution} />
            <MemoBlock title="Market" body={result.market} />
            <MemoBlock title="Competition" body={result.competition} />
            <MemoBlock title="Differentiation" body={result.differentiation} />
            <MemoBlock title="Ask" body={result.ask} />
          </div>
          {result.risks?.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-white">Risks</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {result.risks.map((risk, i) => <li key={i}>- {risk}</li>)}
              </ul>
            </section>
          )}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Markdown</h2>
              <button onClick={copy} className="btn-ghost py-1.5 px-2 text-xs">{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-700 bg-ink-950 p-4 text-xs leading-relaxed text-slate-300">
              {result.markdown || toMarkdown(result)}
            </pre>
          </section>
        </div>
      )}
    </LabShell>
  );
}

function MemoBlock({ title, body }) {
  if (!body) return null;
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </section>
  );
}

function toMarkdown(result = {}) {
  return [
    `# ${result.headline || 'Investor One-Pager'}`,
    '',
    `## Problem\n${result.problem || ''}`,
    `## Solution\n${result.solution || ''}`,
    `## Market\n${result.market || ''}`,
    `## Competition\n${result.competition || ''}`,
    `## Differentiation\n${result.differentiation || ''}`,
    `## Traction\n${result.tractionPlaceholder || ''}`,
    `## Ask\n${result.ask || ''}`,
  ].join('\n\n');
}
