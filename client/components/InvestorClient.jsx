'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, Icon, useToast } from './ui';
import { LabPanel, LabShell, LabShimmerBlock } from './labs/LabShell';
import { SourceAttribution } from './SourceAttribution';

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
      const res = await api.generateInvestorOnepager({ enrich: true });
      setResult(res.result || null);
      toast({
        type: 'success',
        title: res.result?.enriched ? 'One-pager ready (finance-enriched)' : 'One-pager ready',
      });
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
      title="Investor one-pager"
      subtitle="Fundraising memo enriched with You.com finance research on market size, peers, and funding context."
      skills={[{ skill: 'you-finance' }, { skill: 'grok' }]}
      action={(
        <div className="flex gap-2">
          {result && (
            <button onClick={copy} className="btn-ghost text-sm">
              <Icon name="copy" className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy markdown'}
            </button>
          )}
          <button onClick={generate} disabled={generating} className="btn-primary text-sm">
            <Icon name={generating ? 'refresh' : 'sparkle'} className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Researching…' : 'Generate'}
          </button>
        </div>
      )}
    >
      {generating && (
        <LabPanel title="Building memo">
          <p className="mb-4 text-xs text-slate-500">Finance research can take 1–3 minutes, then the memo drafts.</p>
          <LabShimmerBlock rows={4} />
        </LabPanel>
      )}

      {!generating && loading ? (
        <LabPanel><LabShimmerBlock rows={3} /></LabPanel>
      ) : !generating && !result ? (
        <EmptyState icon="bar" title="No investor memo yet" action={<button onClick={generate} className="btn-primary">Generate one-pager</button>}>
          Create a first draft from your product, competitors, and finance signals.
        </EmptyState>
      ) : !generating && result ? (
        <div className="space-y-4">
          <LabPanel
            title="Headline"
            ready
            skills={result.enriched ? [{ skill: 'you-finance' }, { skill: 'grok' }] : [{ skill: 'grok' }]}
          >
            <h2 className="text-xl font-semibold text-white">{result.headline}</h2>
            <SourceAttribution
              attribution={result.attribution}
              sources={result.sources}
              skill={result.skill || (result.enriched ? 'you-finance' : 'grok')}
              skillLabel={result.skillLabel}
              engine={result.financeEngine}
            />
          </LabPanel>
          <div className="grid gap-3 sm:grid-cols-2">
            <MemoBlock title="Problem" body={result.problem} />
            <MemoBlock title="Solution" body={result.solution} />
            <MemoBlock title="Market" body={result.market} />
            <MemoBlock title="Competition" body={result.competition} />
            <MemoBlock title="Differentiation" body={result.differentiation} />
            <MemoBlock title="Ask" body={result.ask} />
          </div>
          {result.financeHighlights?.length > 0 && (
            <LabPanel title="Finance highlights" ready>
              <ul className="space-y-2 text-sm text-slate-400">
                {result.financeHighlights.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </LabPanel>
          )}
          {result.risks?.length > 0 && (
            <LabPanel title="Risks">
              <ul className="space-y-2 text-sm text-slate-400">
                {result.risks.map((risk, i) => <li key={i}>- {risk}</li>)}
              </ul>
            </LabPanel>
          )}
          <LabPanel title="Markdown">
            <div className="mb-3 flex justify-end">
              <button onClick={copy} className="btn-ghost py-1.5 px-2 text-xs">{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-700 bg-ink-950/60 p-4 text-xs leading-relaxed text-slate-300">
              {result.markdown || toMarkdown(result)}
            </pre>
          </LabPanel>
        </div>
      ) : null}
    </LabShell>
  );
}

function MemoBlock({ title, body }) {
  if (!body) return null;
  return (
    <LabPanel title={title}>
      <p className="text-sm leading-relaxed text-slate-400">{body}</p>
    </LabPanel>
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
