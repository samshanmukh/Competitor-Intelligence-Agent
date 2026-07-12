// Published market share from analyst sources (IDC, Gartner, Statista, etc.)
// — extracted from public research, not licensed syndicated data.

import { completeJSON } from './ai.js';
import { research } from './youcom.js';

export function syndicatedSnapshotKey(workspaceId) {
  return `syndicated_snapshot:${workspaceId}`;
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = na.split(' ').filter(Boolean);
  const wb = nb.split(' ').filter(Boolean);
  if (wa[0] && wb[0] && wa[0] === wb[0] && wa[0].length > 3) return true;
  return false;
}

export async function researchSyndicatedShare(marketName, competitorNames) {
  const names = (competitorNames || []).slice(0, 12);
  const query = [
    `Published market share by vendor for "${marketName}".`,
    'Find market share percentages from IDC, Gartner, Statista, Forrester, or official analyst press releases.',
    names.length ? `Prioritize vendors: ${names.join(', ')}.` : '',
    'Include the report year, publisher, and source URL for each figure.',
  ]
    .filter(Boolean)
    .join(' ');

  const payload = await research(query);
  return payload;
}

export async function extractSyndicatedStructured(researchText, competitorNames = []) {
  if (!researchText?.trim()) return null;

  const structured = await completeJSON({
    system:
      'You extract published market share figures from analyst research. Use ONLY numbers explicitly stated in the text with a cited source. Return ONLY valid JSON.',
    user: `From the research below, extract published vendor market share when available:

{
  "market_definition": "how the market/category is defined in the source, or null",
  "year": 2024,
  "vendors": [
    {
      "name": "Vendor name as in the source",
      "share_pct": 23.5,
      "publisher": "IDC | Gartner | Statista | Forrester | other",
      "source_title": "report or article title",
      "source_url": "https://...",
      "confidence": "high | medium | low"
    }
  ],
  "others_share_pct": null,
  "notes": "one sentence on market definition caveats"
}

Rules:
- share_pct must be a number (percentage of market, not revenue dollars).
- Only include vendors with an explicit share figure in the research text.
- confidence "high" = named analyst report with URL; "medium" = press citing analyst; "low" = secondary estimate.
- Tracked competitors to match if found: ${competitorNames.join(', ') || 'none specified'}

RESEARCH:
${researchText.slice(0, 14000)}`,
    maxTokens: 1800,
  });

  if (!structured?.vendors?.length) return null;

  const vendors = structured.vendors
    .filter((v) => v?.name && typeof v.share_pct === 'number' && v.share_pct > 0)
    .map((v) => ({
      name: v.name,
      share_pct: Math.round(v.share_pct * 10) / 10,
      publisher: v.publisher || 'unknown',
      source_title: v.source_title || null,
      source_url: v.source_url || null,
      confidence: v.confidence || 'medium',
    }))
    .sort((a, b) => b.share_pct - a.share_pct);

  if (!vendors.length) return null;

  return {
    market_definition: structured.market_definition || null,
    year: structured.year || null,
    vendors,
    others_share_pct:
      typeof structured.others_share_pct === 'number' ? structured.others_share_pct : null,
    notes: structured.notes || null,
    disclaimer:
      'Published figures from public sources — not licensed Gartner/IDC syndicated data. Market definitions may differ from your workspace.',
  };
}

/** Match syndicated vendors to tracked competitor names. */
export function matchSyndicatedToTracked(syndicated, trackedNames) {
  if (!syndicated?.vendors?.length) return [];

  const tracked = (trackedNames || []).filter(Boolean);
  const matched = [];
  const used = new Set();

  for (const vendor of syndicated.vendors) {
    const hit = tracked.find((t) => !used.has(t.toLowerCase()) && namesMatch(t, vendor.name));
    if (!hit) continue;
    used.add(hit.toLowerCase());
    matched.push({ tracked_name: hit, syndicated_name: vendor.name, ...vendor });
  }

  return matched;
}

/** Build investor-style table rows merging published + estimated share. */
export function buildSyndicatedTable(syndicated, distribution, trackedNames = []) {
  const estByName = new Map(
    (distribution?.items || []).map((i) => [i.name.toLowerCase(), i])
  );
  const matched = matchSyndicatedToTracked(syndicated, trackedNames);
  const matchedKeys = new Set(matched.map((m) => m.tracked_name.toLowerCase()));

  const rows = matched.map((m, idx) => {
    const est = estByName.get(m.tracked_name.toLowerCase());
    const presence = est?.presence_pct ?? est?.share_pct ?? null;
    const delta =
      presence != null ? Math.round((presence - m.share_pct) * 10) / 10 : null;
    return {
      rank: idx + 1,
      name: m.tracked_name,
      syndicated_name: m.syndicated_name,
      published_share_pct: m.share_pct,
      estimated_presence_pct: presence,
      delta_pp: delta,
      publisher: m.publisher,
      source_title: m.source_title,
      source_url: m.source_url,
      confidence: m.confidence,
      revenue_usd: est?.revenue_usd ?? null,
    };
  });

  for (const item of distribution?.items || []) {
    const key = item.name.toLowerCase();
    if (matchedKeys.has(key)) continue;
    rows.push({
      rank: rows.length + 1,
      name: item.name,
      syndicated_name: null,
      published_share_pct: null,
      estimated_presence_pct: item.presence_pct ?? item.share_pct ?? null,
      delta_pp: null,
      publisher: null,
      source_title: null,
      source_url: null,
      confidence: null,
      revenue_usd: item.revenue_usd ?? null,
    });
  }

  rows.sort((a, b) => {
    const ap = a.published_share_pct ?? -1;
    const bp = b.published_share_pct ?? -1;
    if (bp !== ap) return bp - ap;
    return (b.estimated_presence_pct ?? 0) - (a.estimated_presence_pct ?? 0);
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const publishedSum = matched.reduce((s, m) => s + m.share_pct, 0);
  const cr4Published = matched.slice(0, 4).reduce((s, m) => s + m.share_pct, 0);

  return {
    rows,
    matched_count: matched.length,
    vendor_count: syndicated?.vendors?.length ?? 0,
    published_sum_pct: Math.round(publishedSum * 10) / 10,
    cr4_published_pct: Math.round(cr4Published * 10) / 10,
    market_definition: syndicated?.market_definition ?? null,
    year: syndicated?.year ?? null,
    notes: syndicated?.notes ?? null,
    disclaimer: syndicated?.disclaimer ?? null,
  };
}

export async function fetchAndExtractSyndicatedShare(marketName, competitorNames, flattenFn) {
  try {
    const payload = await researchSyndicatedShare(marketName, competitorNames);
    const text = flattenFn ? flattenFn(payload) : '';
    const sources = (payload?.output?.sources || []).slice(0, 8).map((s) => ({
      title: s.title,
      url: s.url,
    }));
    const syndicated = await extractSyndicatedStructured(text, competitorNames);
    if (!syndicated) return { syndicated: null, sources: [] };
    return {
      syndicated: { ...syndicated, sources, captured_at: new Date().toISOString() },
      sources,
    };
  } catch (err) {
    console.warn('[syndicatedShare]', err.message);
    return { syndicated: null, sources: [] };
  }
}
