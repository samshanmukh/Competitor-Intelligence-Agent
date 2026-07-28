'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CompanyLogo, Icon, Skeleton, useToast } from './ui';

export default function MyProductClient() {
  const [competitors, setCompetitors] = useState(null);
  const [form, setForm] = useState({ name: '', pricing_url: '', description: '' });
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [positioning, setPositioning] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.listCompetitors('approved')
      .then(({ competitors }) => setCompetitors(competitors || []))
      .catch((err) => toast({ type: 'error', title: 'Failed to load', message: err.message }));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const extractFromUrl = async () => {
    if (!form.pricing_url) return;
    setExtracting(true);
    try {
      // Search-first company identity (same path as Analysis sparkle).
      const { name, description } = await api.inferProduct(form.pricing_url);
      setForm((f) => ({
        ...f,
        ...(name && !f.name.trim() ? { name } : {}),
        ...(description ? { description } : {}),
      }));
      toast({ type: 'success', title: 'Found your product' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not find company info', message: err.message });
    } finally {
      setExtracting(false);
    }
  };

  const runAnalysis = async () => {
    if (!form.name && !form.description) {
      toast({ type: 'error', title: 'Fill in product name and description first' });
      return;
    }
    setAnalyzing(true);
    try {
      const result = await api.positioning();
      setPositioning(result.analysis);
      setAnalysis({ competitorCount: competitors?.length || 0, ...result });
      toast({ type: 'success', title: 'Analysis complete' });
    } catch (err) {
      toast({ type: 'error', title: 'Analysis failed', message: err.message });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">My product</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define your product and get AI-powered positioning analysis vs your tracked competitors.
        </p>
      </div>

      {/* Product profile */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Product profile</h2>
        <div>
          <label htmlFor="my-product-name" className="label">Product name</label>
          <input id="my-product-name" className="input" value={form.name} onChange={set('name')} placeholder="Acme App" />
        </div>
        <div>
          <label htmlFor="my-product-url" className="label">Pricing page URL</label>
          <div className="flex gap-2">
            <input
              id="my-product-url"
              className="input flex-1"
              value={form.pricing_url}
              onChange={set('pricing_url')}
              placeholder="https://yourapp.com/pricing"
              type="url"
            />
            <button
              onClick={extractFromUrl}
              disabled={extracting || !form.pricing_url}
              className="btn-ghost shrink-0"
              title="Extract info from URL"
            >
              {extracting
                ? <Icon name="refresh" className="h-4 w-4 animate-spin" />
                : <Icon name="sparkle" className="h-4 w-4" />
              }
              {extracting ? 'Reading…' : 'Auto-fill'}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="my-product-description" className="label">Product description / market</label>
          <textarea
            id="my-product-description"
            className="input min-h-24 resize-y"
            value={form.description}
            onChange={set('description')}
            placeholder="Describe what your product does and who it's for. E.g.: Project management tool for remote engineering teams, focused on async collaboration."
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-500">
            Analyzing against <strong className="text-slate-300">{competitors?.length || '…'}</strong> tracked competitors
          </p>
          <button
            onClick={runAnalysis}
            disabled={analyzing || !competitors?.length}
            className="btn-primary"
          >
            {analyzing
              ? <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Analyzing…</>
              : <><Icon name="sparkle" className="h-4 w-4" /> Run Analysis</>
            }
          </button>
        </div>
      </div>

      {/* Analysis loading */}
      {analyzing && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
        </div>
      )}

      {/* Positioning analysis */}
      {positioning && !analyzing && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Positioning Analysis</h2>
            <span className="chip border-accent/30 bg-accent/10 text-accent-soft">AI-generated</span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            {positioning.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <h3 key={i} className="mt-4 mb-1 text-sm font-semibold text-slate-200">{line.slice(2, -2)}</h3>;
              }
              if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 text-sm text-slate-400 list-disc">{line.slice(2)}</li>;
              }
              return line ? <p key={i} className="text-sm text-slate-400 leading-relaxed">{line}</p> : <br key={i} />;
            })}
          </div>
        </div>
      )}

      {/* Competitors overview */}
      {competitors !== null && !analyzing && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Competitors in Analysis</h2>
          {competitors.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">
              No competitors tracked yet. <a href="/discover" className="text-accent-soft">Discover some first →</a>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {competitors.map((c) => (
                <div key={c.id} className="card p-3 flex items-center gap-2">
                  <CompanyLogo
                    name={c.name}
                    website={c.website}
                    pricing_url={c.pricing_url}
                    className="h-7 w-7 rounded"
                    textClassName="text-xs"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    {c.value_score != null && (
                      <p className="text-xs text-slate-500">Value: {c.value_score}/10</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
