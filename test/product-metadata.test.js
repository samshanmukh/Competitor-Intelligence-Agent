import assert from 'node:assert/strict';
import test from 'node:test';
import { extractProductMetadata } from '../client/lib/productMetadata.js';

test('extractProductMetadata reads social metadata in either attribute order', () => {
  const html = `
    <html><head>
      <title>Zup - Captions that sound like you</title>
      <meta content="Zup - Captions that sound like you" property="og:title">
      <meta name="description" content="Choose photos and get captions in your tone &amp; style.">
    </head></html>`;
  assert.deepEqual(extractProductMetadata(html, 'https://zupapps.com'), {
    name: 'Zup',
    description: 'Choose photos and get captions in your tone & style.',
    source: 'https://zupapps.com/',
  });
});
