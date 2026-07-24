import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeMarketDistribution,
  diffDistribution,
  enrichCompaniesWithDistribution,
  getSignificantShifts,
  parseMoneyToUsd,
  resolveTamUsd,
} from '../server/services/marketDistribution.js';

test('parseMoneyToUsd handles common market-size formats', () => {
  assert.equal(parseMoneyToUsd('$1.25B'), 1_250_000_000);
  assert.equal(parseMoneyToUsd('750 million'), 750_000_000);
  assert.equal(parseMoneyToUsd('42,500'), 42_500);
  assert.equal(parseMoneyToUsd(12_000), 12_000);
  assert.equal(parseMoneyToUsd('unknown'), null);
  assert.equal(parseMoneyToUsd(0), null);
});

test('resolveTamUsd respects source precedence', () => {
  assert.deepEqual(
    resolveTamUsd({
      marketModel: { tam: { value_usd: 2_000_000_000 } },
      marketIntel: { size_current: '$1B' },
    }),
    { tamUsd: 2_000_000_000, tamSource: 'market_model' },
  );

  assert.deepEqual(
    resolveTamUsd({
      marketIntel: { history: [{ size_usd_millions: 500 }, { size_usd_millions: 625 }] },
    }),
    { tamUsd: 625_000_000, tamSource: 'research_history' },
  );
});

test('computeMarketDistribution triangulates signals and preserves totals', () => {
  const result = computeMarketDistribution(
    [
      { name: 'Alpha', revenue_usd: 100_000_000, review_count: 800 },
      { name: 'Beta', revenue: '$40M', review_count: 200 },
      { name: 'Gamma', revenue_usd: 20_000_000 },
    ],
    2_000_000_000,
    'market_model',
    {
      trafficByName: { alpha: 5_000_000, beta: 2_000_000 },
      trafficKinds: { alpha: 'research', beta: 'research' },
    },
  );

  assert.equal(result.method, 'triangulated');
  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].name, 'Alpha');
  assert.equal(result.items[0].share_pct_tam, 5);
  assert.equal(result.items[0].signals.traffic_kind, 'research');
  assert.equal(result.tracked_sum_pct, 8);
  assert.equal(result.remainder_pct, 92);
  assert.equal(
    Math.round(result.items.reduce((sum, item) => sum + item.presence_pct, 0) * 10) / 10,
    100,
  );
});

test('computeMarketDistribution returns a stable empty result', () => {
  const result = computeMarketDistribution([{ name: 'Alpha' }], null);

  assert.equal(result.method, 'none');
  assert.deepEqual(result.items, []);
  assert.equal(result.cr4_pct, null);
  assert.match(result.disclaimer, /No revenue, traffic, or review signals/);
});

test('distribution diffs threshold noise and significant shifts', () => {
  const pulse = diffDistribution(
    {
      items: [
        { name: 'Alpha', presence_pct: 40 },
        { name: 'Beta', presence_pct: 30 },
      ],
    },
    {
      items: [
        { name: 'Alpha', presence_pct: 46 },
        { name: 'Beta', presence_pct: 29.7 },
      ],
    },
  );

  assert.deepEqual(pulse.shifts, [
    { name: 'Alpha', prev_pct: 40, next_pct: 46, delta_pct: 6 },
  ]);
  assert.deepEqual(getSignificantShifts(pulse), pulse.shifts);
  assert.match(pulse.summary, /Alpha \+6pp/);
});

test('enrichCompaniesWithDistribution matches names case-insensitively', () => {
  const companies = [{ name: 'Alpha', revenue_usd: 10 }, { name: 'Untracked' }];
  const enriched = enrichCompaniesWithDistribution(companies, {
    method: 'revenue_implied',
    items: [{ name: 'alpha', revenue_usd: 20, share_pct_tam: 4, presence_pct: 60 }],
  });

  assert.deepEqual(enriched[0], {
    name: 'Alpha',
    revenue_usd: 20,
    share_pct: 4,
    presence_pct: 60,
    share_method: 'revenue_implied',
  });
  assert.equal(enriched[1], companies[1]);
});
