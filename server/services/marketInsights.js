// Automated insight cards linking TAM/SOM model ↔ competitor distribution.

function fmtUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

/** @param {object|null} marketModel workspace market model row */
/** @param {object|null} distribution from computeMarketDistribution / snapshot */
/** @param {object|null} syndicated syndicated share snapshot */
export function generateMarketInsights(marketModel, distribution, syndicated = null) {
  if (!distribution?.items?.length) {
    return [{
      type: 'missing',
      tone: 'slate',
      title: 'No competitor distribution yet',
      body: 'Run market research on the Distribution page (or Analysis report) to estimate how presence is split across your tracked competitors.',
    }];
  }

  const insights = [];
  const cr4 = distribution.cr4_pct ?? 0;
  const top = distribution.items[0];
  const tam = marketModel?.tam?.value_usd;
  const sam = marketModel?.sam?.value_usd;
  const som = marketModel?.som?.value_usd;
  const targetShare = marketModel?.inputs?.target_share;

  if (cr4 >= 45) {
    insights.push({
      type: 'concentrated',
      tone: 'amber',
      title: 'Concentrated market',
      body: `Top 4 players hold ~${cr4}% of estimated presence — expect pricing pressure and feature parity moves from incumbents.`,
    });
  } else {
    insights.push({
      type: 'fragmented',
      tone: 'emerald',
      title: 'Fragmented market',
      body: `Top 4 hold ~${cr4}% presence — differentiation and niche focus likely matter more than racing to the bottom on price.`,
    });
  }

  if (top) {
    const topPct = top.presence_pct ?? top.share_pct ?? 0;
    const topTamPct = top.share_pct_tam;
    let body = `${top.name} leads tracked competitors at ~${topPct}% estimated presence`;
    if (topTamPct != null && tam) body += ` (~${topTamPct}% of TAM, ${fmtUsd(top.revenue_usd)} est. revenue)`;
    body += '.';
    insights.push({ type: 'leader', tone: 'indigo', title: 'Category leader', body });
  }

  if (tam && som && targetShare != null) {
    const somTamPct = tam > 0 ? Math.round((som / tam) * 1000) / 10 : null;
    const topTamPct = top?.share_pct_tam;
    if (somTamPct != null) {
      let body = `Your SOM target is ${fmtUsd(som)} (${Math.round(targetShare * 100)}% of ${fmtUsd(sam || tam * (marketModel?.inputs?.serviceable_pct || 0.3))} SAM)`;
      if (somTamPct != null) body += ` — ~${somTamPct}% of TAM`;
      if (topTamPct != null && topTamPct > somTamPct * 3) {
        body += `. ${top?.name || 'The leader'} at ~${topTamPct}% of TAM — your niche focus keeps the gap plausible.`;
      } else if (topTamPct != null) {
        body += `. Leader at ~${topTamPct}% of TAM — room to grow share within your SAM.`;
      } else {
        body += '.';
      }
      insights.push({ type: 'som', tone: 'accent', title: 'Your obtainable slice', body });
    }
  }

  if (distribution.remainder_pct != null && distribution.remainder_pct > 25) {
    insights.push({
      type: 'long_tail',
      tone: 'slate',
      title: 'Long-tail remainder',
      body: `~${distribution.remainder_pct}% of TAM sits outside tracked competitors — fragmented demand or unmonitored players.`,
    });
  }

  if (syndicated?.table?.matched_count > 0) {
    const top = syndicated.table.rows?.find((r) => r.published_share_pct != null);
    if (top) {
      const delta =
        top.delta_pp != null
          ? ` Your triangulated estimate is ${Math.abs(top.delta_pp)}pp ${top.delta_pp > 0 ? 'above' : 'below'} published share.`
          : '';
      insights.push({
        type: 'syndicated',
        tone: 'indigo',
        title: 'Published share available',
        body: `${top.name} at ${top.published_share_pct}% per ${top.publisher || 'analyst source'} (${syndicated.year || 'recent'}).${delta} Compare market definitions on the Distribution page.`,
      });
    }
  } else if (syndicated && syndicated.vendors?.length === 0) {
    insights.push({
      type: 'syndicated_missing',
      tone: 'slate',
      title: 'No published share found',
      body: 'We could not find citable analyst market share for this category — estimated presence is triangulated from revenue, traffic, and reviews.',
    });
  }

  return insights;
}

export const METHODOLOGY = {
  title: 'How estimated market presence works',
  sections: [
    {
      heading: 'What this measures',
      body: 'Estimated market presence shows how value, revenue, or attention may be split across your tracked competitors. Published analyst share (when found) is shown separately — it is not blended into estimates.',
    },
    {
      heading: 'Estimated presence (triangulated)',
      bullets: [
        'Revenue (40%) — inferred from finance research and public estimates',
        'Web traffic (25%) — monthly visits from research citations, or relative rank proxy when absolute visits are missing',
        'Reviews (20%) — G2/review volume and ratings from research',
      ],
    },
    {
      heading: 'Published market share',
      body: 'When IDC, Gartner, Statista, or similar figures appear in public sources, we extract them into a separate syndicated table with source links. These are not licensed syndicated reports — always verify market definition and year.',
    },
    {
      heading: 'TAM denominator',
      body: 'When your workspace market model defines TAM, revenue-implied share (% of TAM) is shown alongside relative presence. Without TAM, bars show relative scale among tracked competitors only.',
    },
    {
      heading: 'CR4',
      body: 'CR4 is the combined estimated presence of the top four competitors — a common investor metric for market concentration. A separate CR4 for published share is shown when analyst data is available.',
    },
    {
      heading: 'Pulse & alerts',
      body: 'Each market intelligence run saves a snapshot. Shifts ≥0.5pp appear in reports; shifts ≥5pp trigger push alerts and weekly digest highlights. View live pulse on the Distribution page.',
    },
    {
      heading: 'Limitations',
      body: 'Private-company revenue is estimated. Apify improves absolute traffic when you have credits; otherwise research and relative proxies fill gaps. Always treat outputs as hypotheses to defend with sources — use Fact-check on your market model for independent verification.',
    },
  ],
};
