// Diff + analysis agent: computes a unified diff between two snapshots and asks
// Grok to summarize what changed in the competitor's pricing.

import { createTwoFilesPatch } from 'diff';
import { completeJSON } from '../services/ai.js';

const ANALYSIS_SYSTEM = `You are a competitive pricing analyst. You read diffs of competitor pricing pages and explain what changed.
Be specific about plan names, price points, and features added or removed. Return ONLY valid JSON.`;

/**
 * Build a unified diff between previous and current markdown.
 */
export function buildDiff(prevContent, currentContent, label = 'pricing') {
  return createTwoFilesPatch(
    `${label} (previous)`,
    `${label} (current)`,
    prevContent || '',
    currentContent || '',
    '',
    '',
    { context: 3 }
  );
}

/**
 * Ask Grok to summarize a pricing diff. Returns a structured analysis object.
 * Falls back to a minimal object if the model output can't be parsed.
 */
export async function analyzeDiff({ competitorName, diff }) {
  // Trim very large diffs to keep within token limits while preserving the head.
  const trimmedDiff = diff.length > 12000 ? diff.slice(0, 12000) + '\n...[diff truncated]...' : diff;

  const prompt = `Summarize what changed in this competitor's pricing. Be specific about plan names, price points, features added/removed.

Competitor: ${competitorName}

Unified diff of the pricing page (lines starting with "+" were added, "-" were removed):
${trimmedDiff}

Return JSON shaped exactly as:
{
  "summary": "one-sentence headline of the most important change",
  "impact": "low" | "medium" | "high",
  "price_changes": [ { "plan": "", "old_price": "", "new_price": "" } ],
  "features_added": [ "" ],
  "features_removed": [ "" ],
  "plans_added": [ "" ],
  "plans_removed": [ "" ],
  "details": "a short paragraph with specifics"
}
Use empty arrays/strings where nothing applies.`;

  let analysis;
  try {
    analysis = await completeJSON({
      system: ANALYSIS_SYSTEM,
      user: prompt,
      maxTokens: 1200,
    });
  } catch (err) {
    analysis = null;
  }

  if (!analysis || typeof analysis !== 'object') {
    analysis = {
      summary: 'Pricing page changed (automatic analysis unavailable).',
      impact: 'medium',
      price_changes: [],
      features_added: [],
      features_removed: [],
      plans_added: [],
      plans_removed: [],
      details: '',
    };
  }

  // Normalize fields so the frontend can rely on them.
  return {
    summary: String(analysis.summary || 'Pricing page changed.'),
    impact: ['low', 'medium', 'high'].includes(analysis.impact) ? analysis.impact : 'medium',
    price_changes: Array.isArray(analysis.price_changes) ? analysis.price_changes : [],
    features_added: arr(analysis.features_added),
    features_removed: arr(analysis.features_removed),
    plans_added: arr(analysis.plans_added),
    plans_removed: arr(analysis.plans_removed),
    details: String(analysis.details || ''),
  };
}

function arr(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
}

export const analysisAgent = { buildDiff, analyzeDiff };
