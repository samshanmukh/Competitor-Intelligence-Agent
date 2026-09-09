import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fallbackCandidates,
  normalizeCandidates,
  searchHits,
} from '../client/lib/competitorDiscovery.js';

test('searchHits supports nested You.com web results', () => {
  const hits = searchHits({ results: { web: [{ title: 'Buffer', url: 'https://buffer.com', snippet: 'Social media tools' }] } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].url, 'https://buffer.com/');
});

test('candidate fallback excludes the product and directory sites', () => {
  const payload = {
    results: [
      { title: 'Zup', url: 'https://zupapps.com' },
      { title: 'Best alternatives', url: 'https://g2.com/categories/social-media' },
      { title: 'A comparison article', url: 'https://publisher.example/blog/caption-tools' },
      { title: 'Buffer | Social media toolkit', url: 'https://buffer.com/pricing', snippet: 'Publish and schedule posts.' },
    ],
  };
  const candidates = fallbackCandidates(payload, 'https://www.zupapps.com');
  assert.deepEqual(candidates.map((item) => item.name), ['Buffer']);
  assert.equal(candidates[0].pricing_url, 'https://buffer.com/pricing');
});

test('normalizeCandidates de-duplicates competitors by host', () => {
  const candidates = normalizeCandidates([
    { name: 'Buffer', pricing_url: 'https://buffer.com/pricing' },
    { name: 'Buffer duplicate', pricing_url: 'https://www.buffer.com/' },
  ]);
  assert.equal(candidates.length, 1);
});
