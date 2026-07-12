/**
 * Smoke tests for market distribution phases 1–4 + syndicated share + traffic fallbacks.
 * Run: node scripts/test-market-phases.js
 */
import {
  computeMarketDistribution,
  diffDistribution,
  getSignificantShifts,
  parseMoneyToUsd,
  resolveTamUsd,
  SIGNIFICANT_SHIFT_PP,
} from '../server/services/marketDistribution.js';
import { generateMarketInsights } from '../server/services/marketInsights.js';
import {
  buildSyndicatedTable,
  matchSyndicatedToTracked,
} from '../server/services/syndicatedShare.js';
import { trafficFromCompanies, trafficFromResearchText } from '../server/services/trafficSignals.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

// Phase 1
assert(parseMoneyToUsd('$120M') === 120000000, 'parseMoneyToUsd $120M');
const tam = resolveTamUsd({ marketModel: { tam: { value_usd: 2e9 } }, marketIntel: {} });
assert(tam.tamUsd === 2e9 && tam.tamSource === 'market_model', 'resolveTamUsd from model');

const companies = [
  { name: 'Alpha', revenue_usd: 100e6, review_count: 800 },
  { name: 'Beta', revenue_usd: 40e6, review_count: 200 },
  { name: 'Gamma', revenue_usd: 20e6 },
];
const d = computeMarketDistribution(companies, 2e9, 'market_model', {
  trafficByName: { alpha: 5e6, beta: 2e6 },
  trafficKinds: { alpha: 'apify', beta: 'research' },
  trafficMeta: { apify_fetched: 1, research: 1, total: 2 },
});
assert(d.method === 'triangulated', 'Phase 2 triangulated method');
assert(d.items.length === 3, 'three competitors in distribution');
assert(typeof d.cr4_pct === 'number', 'CR4 computed');
assert(d.items[0].signals?.traffic_kind === 'apify', 'traffic_kind on item');

// Traffic from companies
const fromCo = trafficFromCompanies([
  { name: 'Acme', monthly_visits: 2500000 },
  { name: 'Beta', monthly_visits: '1.2M' },
]);
assert(fromCo.byName.acme === 2500000, 'trafficFromCompanies numeric');
assert(fromCo.byName.beta === 1200000, 'trafficFromCompanies parsed string');

// Traffic from research text
const fromText = trafficFromResearchText(
  'Alpha Corp receives about 3.5 million monthly visits according to SimilarWeb.',
  [{ name: 'Alpha Corp' }]
);
assert(fromText.byName['alpha corp'] > 0, 'trafficFromResearchText extracts visits');

// Phase 2 pulse
const prev = {
  items: [
    { name: 'Alpha', presence_pct: 40, share_pct: 40 },
    { name: 'Beta', presence_pct: 30, share_pct: 30 },
  ],
};
const pulse = diffDistribution(prev, d);
assert(pulse.shifts.length > 0, 'pulse detects shifts');

// Phase 4 significant shifts
const fakePulse = {
  shifts: [
    { name: 'Alpha', delta_pct: 6 },
    { name: 'Beta', delta_pct: -2 },
    { name: 'Gamma', delta_pct: -5.5 },
  ],
};
const sig = getSignificantShifts(fakePulse);
assert(sig.length === 2, `significant shifts at >=${SIGNIFICANT_SHIFT_PP}pp`);
assert(sig.every((s) => Math.abs(s.delta_pct) >= SIGNIFICANT_SHIFT_PP), 'all significant shifts meet threshold');

// Phase 3 insights
const model = {
  tam: { value_usd: 2e9 },
  sam: { value_usd: 600e6 },
  som: { value_usd: 12e6 },
  inputs: { target_share: 0.02, serviceable_pct: 0.3 },
};
const insights = generateMarketInsights(model, d);
assert(insights.length >= 2, 'insights generated');
assert(insights.some((i) => i.type === 'leader'), 'leader insight present');

const emptyInsights = generateMarketInsights(model, null);
assert(emptyInsights[0]?.type === 'missing', 'missing distribution insight');

// Syndicated share
const syndicated = {
  market_definition: 'CRM software',
  year: 2024,
  vendors: [
    { name: 'Alpha Inc', share_pct: 22, publisher: 'IDC', source_url: 'https://example.com', confidence: 'high' },
    { name: 'OtherCo', share_pct: 15, publisher: 'Statista', confidence: 'medium' },
  ],
  disclaimer: 'test',
};
const matched = matchSyndicatedToTracked(syndicated, ['Alpha', 'Beta']);
assert(matched.length === 1 && matched[0].tracked_name === 'Alpha', 'syndicated vendor fuzzy match');

const table = buildSyndicatedTable(syndicated, d, ['Alpha', 'Beta', 'Gamma']);
assert(table.rows.length >= 3, 'syndicated table includes unmatched tracked');
assert(table.rows[0].published_share_pct != null, 'published share on row');
const synInsights = generateMarketInsights(model, d, { ...syndicated, table });
assert(synInsights.some((i) => i.type === 'syndicated'), 'syndicated insight when matched');

console.log(failed ? `\n${failed} test(s) failed` : '\nAll phase tests passed');
process.exit(failed ? 1 : 0);
