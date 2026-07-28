import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __demoFastInternals } from '../server/services/demoCompetitorsFast.js';

const {
  normalizeUrl,
  sanitizeMarket,
  fallbackMarketLabel,
  clampStatement,
  buildCompetitorQueries,
  rivalEvidenceLooksUseful,
  knownWebsiteForName,
  scrapeEntryPrice,
} = __demoFastInternals;

describe('demoCompetitorsFast identity helpers', () => {
  it('normalizeUrl auto-prepends https://', () => {
    assert.equal(normalizeUrl('goremy.ai'), 'https://goremy.ai/');
    assert.equal(normalizeUrl('https://runcoach.com/pricing'), 'https://runcoach.com/pricing');
    assert.equal(normalizeUrl(''), null);
  });

  it('sanitizeMarket never returns unknown when snippets exist', () => {
    const snippets = 'Goremy is an AI GTM platform for founders. SaaS sales tooling.';
    assert.equal(/unknown/i.test(sanitizeMarket('unknown', 'goremy.ai', snippets)), false);
    assert.equal(/unknown/i.test(sanitizeMarket('', 'goremy.ai', snippets)), false);
    assert.ok(sanitizeMarket('AI GTM platforms', 'goremy.ai', snippets).includes('GTM'));
  });

  it('fallbackMarketLabel uses category hints from snippets', () => {
    const label = fallbackMarketLabel('runcoach.com', 'AI running coach app for race training');
    assert.match(label, /running|Runcoach/i);
  });

  it('clampStatement drops empty-state LLM filler', () => {
    assert.equal(clampStatement('No information available from search results.'), null);
    assert.ok(clampStatement('AI coaching platform for runners.'));
  });

  it('buildCompetitorQueries prefer closest-competitors phrasing', () => {
    const qs = buildCompetitorQueries({
      companyName: 'Remy',
      host: 'goremy.ai',
      market: 'AI product agents',
      statement: 'Remy is a product agent that builds and ships full-stack apps.',
    });
    assert.match(qs[0], /closest competitors to Remy goremy\.ai/i);
    assert.match(qs[0], /AI app builder|vibe coding/i);
    assert.equal(/running coach/i.test(qs[0]), false);
    // Must not mis-classify "runs products" as a running coach.
    const qs2 = buildCompetitorQueries({
      companyName: 'Remy',
      host: 'goremy.ai',
      market: 'AI agents for product development',
      statement: 'Remy is an AI agent that builds, ships, and runs products.',
    });
    assert.equal(/running coach/i.test(qs2.join(' ')), false);
    assert.match(qs2[1], /Lovable|Bolt\.new|Replit/i);
  });

  it('rivalEvidenceLooksUseful detects AI builder peer set', () => {
    assert.equal(
      rivalEvidenceLooksUseful('Lovable and Bolt.new compared with Replit Agent and v0 for AI app building'),
      true
    );
    assert.equal(rivalEvidenceLooksUseful('short'), false);
    // Name-collision listicles without same-class peers must NOT count as useful.
    assert.equal(
      rivalEvidenceLooksUseful(
        'Top Remi AI Alternatives, Competitors. Remi AI vs Solvoyo. Remi AI Alternatives on GetApp. '.repeat(5),
        { host: 'goremy.ai', companyName: 'Remy' }
      ),
      false
    );
  });

  it('knownWebsiteForName maps AI builder peers', () => {
    assert.equal(knownWebsiteForName('Lovable'), 'https://lovable.dev');
    assert.equal(knownWebsiteForName('Bolt.new'), 'https://bolt.new');
    assert.equal(knownWebsiteForName('Replit Agent'), 'https://replit.com');
    assert.equal(knownWebsiteForName('v0'), 'https://v0.dev');
  });

  it('scrapeEntryPrice keeps $/mo billed annually and converts periods', () => {
    // Do not divide "$19.99/mo billed annually" by 12 again.
    assert.equal(
      scrapeEntryPrice('Turbo $19.99/mo billed annually'),
      19.99
    );
    assert.equal(
      scrapeEntryPrice('weekly $17.99/week monthly $39.99 quarterly $89.99/3mo'),
      30 // 89.99/3
    );
    assert.equal(
      scrapeEntryPrice(
        'Jobright Free $0. Turbo weekly $14.99–$17.99/week; monthly $29.99–$39.99; quarterly $69.99–$89.99/3mo; annual $19.99/mo billed annually.'
      ),
      19.99
    );
    assert.equal(scrapeEntryPrice('Free plan $0 forever'), 0);
    assert.equal(scrapeEntryPrice('No dollars here'), null);
  });
});
