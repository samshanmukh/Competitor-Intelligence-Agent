import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPositioningMapPoints, resolveUnpricedLaneX } from '../client/lib/positioningMapData.js';
import { withHeuristicValueScores } from '../server/services/demoCompetitorsFast.js';

/** runcoach-style: you + 4 rivals, only 1 rival priced */
const RUNCOACH_YOU = {
  name: 'Runna',
  website: 'https://www.runna.com',
  entry_price: 15.99,
  isYou: true,
  statement: 'AI running coach that builds personalized training plans for race goals.',
};

const RUNCOACH_RIVALS = [
  { name: 'Nike Run Club', website: 'https://www.nike.com', entry_price: null, statement: 'Free Nike-branded run tracking and guided workouts.' },
  { name: 'Strava', website: 'https://www.strava.com', entry_price: 11.99, statement: 'Social fitness network for runners and cyclists.' },
  { name: 'Garmin Connect', website: 'https://www.garmin.com', entry_price: null, statement: 'Device-linked training and health analytics platform.' },
  { name: 'Couch to 5K', website: 'https://www.c25k.com', entry_price: null, statement: 'Beginner walk-to-run program for first 5Ks.' },
];

describe('positioning map includes unpriced rivals', () => {
  it('resolveUnpricedLaneX sits right of max known price', () => {
    assert.equal(resolveUnpricedLaneX([10, 20]), 23);
    assert.equal(resolveUnpricedLaneX([]), 100);
  });

  it('runcoach-style payload plots you + all 4 rivals', () => {
    const scored = withHeuristicValueScores(RUNCOACH_YOU, RUNCOACH_RIVALS);
    assert.ok(scored.you.value_score != null);
    assert.equal(scored.rivals.length, 4);
    for (const r of scored.rivals) {
      assert.ok(r.value_score != null, `${r.name} should have value_score`);
    }

    const { points, unpricedX, knownCount } = buildPositioningMapPoints(scored.you, scored.rivals);
    assert.equal(points.length, 5, 'you + 4 rivals on chart');
    assert.equal(knownCount, 2, 'you + Strava priced');
    assert.equal(unpricedX, Math.round(Math.max(15.99, 11.99) * 1.15 * 100) / 100);

    const unpriced = points.filter((p) => p.priceUnknown);
    const priced = points.filter((p) => !p.priceUnknown);
    assert.equal(unpriced.length, 3);
    assert.equal(priced.length, 2);
    for (const p of unpriced) {
      assert.equal(p.price, unpricedX);
      assert.notEqual(p.price, 0);
    }
    assert.ok(points.every((p) => p.value != null && p.value >= 1 && p.value <= 10));
    assert.equal(scored.you.statement, RUNCOACH_YOU.statement);
    assert.equal(points.find((p) => p.isYou)?.statement, RUNCOACH_YOU.statement);
    assert.equal(
      points.find((p) => p.name === 'Strava')?.statement,
      'Social fitness network for runners and cyclists.'
    );
  });

  it('all-unpriced still plots everyone (fallback lane)', () => {
    const you = { name: 'Acme', website: 'https://acme.test', entry_price: null };
    const rivals = [
      { name: 'Beta', website: 'https://beta.test', entry_price: null },
      { name: 'Gamma', website: 'https://gamma.test', entry_price: null },
    ];
    const scored = withHeuristicValueScores(you, rivals);
    const { points, unpricedX } = buildPositioningMapPoints(scored.you, scored.rivals);
    assert.equal(points.length, 3);
    assert.equal(unpricedX, 100);
    assert.ok(points.every((p) => p.priceUnknown && p.price === 100));
  });
});
