import assert from 'node:assert/strict';
import test from 'node:test';
import { extractMetaText, htmlToText, isStubHtml } from '../server/services/youcom.js';

const GOREMY_STUB = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="robots" content="index, follow">
    <title>App</title>
  </head>
  <body></body>
</html>`;

const GOREMY_REAL = `<!doctype html>
<html lang="en">
  <head>
    <title>Remy — An AI agent that builds, ships, and runs products.</title>
    <meta name="description" content="Remy takes your idea from conversation to production, then keeps working on it with you." />
    <meta property="og:title" content="Remy — An AI agent that builds, ships, and runs products." />
    <meta property="og:description" content="Remy takes your idea from conversation to production, then keeps working on it with you." />
  </head>
  <body>
    <div id="root"><main><h1>Remy</h1><p>An AI agent that builds, ships, and runs products.</p></main></div>
  </body>
</html>`;

test('isStubHtml detects You.com empty SPA shells', () => {
  assert.equal(isStubHtml(GOREMY_STUB), true);
  assert.equal(isStubHtml(GOREMY_REAL), false);
});

test('extractMetaText prefers og tags and skips generic App title', () => {
  assert.equal(extractMetaText(GOREMY_STUB), '');
  const meta = extractMetaText(GOREMY_REAL);
  assert.match(meta, /Remy/);
  assert.match(meta, /conversation to production/);
});

test('htmlToText falls back to meta when body is empty', () => {
  const metaOnly = `<html><head>
    <title>Acme Analytics</title>
    <meta name="description" content="B2B analytics for revenue teams." />
  </head><body><div id="root"></div></body></html>`;
  const text = htmlToText(metaOnly);
  assert.match(text, /Acme Analytics/);
  assert.match(text, /B2B analytics/);
});

test('htmlToText keeps body content for prerendered marketing pages', () => {
  const text = htmlToText(GOREMY_REAL);
  assert.match(text, /builds, ships, and runs products/i);
  assert.ok(text.length > 40);
});
