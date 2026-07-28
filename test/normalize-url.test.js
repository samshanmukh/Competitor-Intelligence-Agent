import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureHttps, normalizeHttpUrl } from '../server/lib/normalizeUrl.js';

describe('ensureHttps', () => {
  it('prepends https to bare hosts', () => {
    assert.equal(ensureHttps('goremy.ai'), 'https://goremy.ai');
    assert.equal(ensureHttps('www.goremy.ai'), 'https://www.goremy.ai');
    assert.equal(ensureHttps('goremy.ai/pricing'), 'https://goremy.ai/pricing');
  });

  it('leaves http(s) alone', () => {
    assert.equal(ensureHttps('https://goremy.ai'), 'https://goremy.ai');
    assert.equal(ensureHttps('http://example.com'), 'http://example.com');
  });

  it('does not prepend to empty or other schemes', () => {
    assert.equal(ensureHttps(''), '');
    assert.equal(ensureHttps('   '), '');
    assert.equal(ensureHttps(null), '');
    assert.equal(ensureHttps('mailto:hi@x.com'), 'mailto:hi@x.com');
  });

  it('strips leading slashes before prepending', () => {
    assert.equal(ensureHttps('//goremy.ai'), 'https://goremy.ai');
  });

  it('normalizeHttpUrl aliases ensureHttps', () => {
    assert.equal(normalizeHttpUrl('goremy.ai'), ensureHttps('goremy.ai'));
  });
});
