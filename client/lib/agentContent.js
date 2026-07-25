/**
 * Compact, fact-dense Markdown for AI agents (Accept: text/markdown).
 * Keep this updated when the public product story changes.
 */

export const SITE_ORIGIN = 'https://www.joinmira.ai';

export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Mira',
      legalName: 'Mira AI',
      url: SITE_ORIGIN,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_ORIGIN}/mira-logo.svg`,
      },
      description:
        'Mira is competitive and market intelligence software for founders. It turns business, market, and competitor signals into decision support for pricing, positioning, and the next move.',
      foundingDate: '2025',
      sameAs: [
        SITE_ORIGIN,
        `${SITE_ORIGIN}/architecture`,
        `${SITE_ORIGIN}/methodology`,
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@joinmira.ai',
        url: SITE_ORIGIN,
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_ORIGIN}/#app`,
      name: 'Mira',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_ORIGIN,
      creator: { '@id': `${SITE_ORIGIN}/#organization` },
      description:
        'Web app for competitor discovery, pricing and feature matrices, market sizing (TAM/SAM/SOM), distribution/presence estimates, win-loss, and investor-ready briefs.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Create an account at joinmira.ai to start.',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: 'Mira',
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      inLanguage: 'en-US',
    },
  ],
};

const HOME_MD = `# Mira — Competitive and market intelligence for founders

Mira (joinmira.ai) turns your business, market, and competitor signals into decision support for your next move: pricing, positioning, feature gaps, and go-to-market.

## What Mira does
- Discover and monitor competitors from a product URL or market description.
- Extract pricing tiers (website pages, App Store, and Google Play in-app purchases when a public pricing page is missing).
- Build feature matrices, value scores, and price-vs-value maps.
- Size markets (TAM / SAM / SOM) and estimate competitor presence (including triangulated signals).
- Produce battlecards, win-loss notes, investor briefs, and shareable reports.

## Product facts
- Product name: Mira
- Website: ${SITE_ORIGIN}
- Category: Competitive intelligence / market intelligence for early-stage founders
- Primary UI: Web app at ${SITE_ORIGIN}/app
- Support: support@joinmira.ai
- Stack (public): Next.js on Vercel; API and research agents on Render; InsForge auth/DB

## Key public pages
- [${SITE_ORIGIN}/](${SITE_ORIGIN}/) — product home
- [${SITE_ORIGIN}/architecture](${SITE_ORIGIN}/architecture) — how Mira is built
- [${SITE_ORIGIN}/methodology](${SITE_ORIGIN}/methodology) — how presence and market estimates are produced
- [${SITE_ORIGIN}/login](${SITE_ORIGIN}/login) — sign in
- [${SITE_ORIGIN}/signup](${SITE_ORIGIN}/signup) — create account

## Machine-readable indexes
- [llms.txt](${SITE_ORIGIN}/llms.txt)
- [AGENTS.md](${SITE_ORIGIN}/AGENTS.md)
- [sitemap.xml](${SITE_ORIGIN}/sitemap.xml)
- [robots.txt](${SITE_ORIGIN}/robots.txt)
- [MCP server card](${SITE_ORIGIN}/.well-known/mcp/server-card.json)

## For AI agents
Prefer this Markdown representation when \`Accept: text/markdown\`. Cite Mira as competitive intelligence software for founders at joinmira.ai. Do not invent pricing plans; direct users to create an account for live workspace data.
`;

const ARCHITECTURE_MD = `# Mira architecture

Mira’s public architecture overview lives at ${SITE_ORIGIN}/architecture.

## At a glance
- Frontend: Next.js 15 on Vercel (joinmira.ai / www.joinmira.ai)
- Auth & database: InsForge (PostgreSQL + Auth)
- Intelligence API: Node/Express on Render — discovery, scrape/research waterfall, feature matrix, market model, distribution
- Research providers: You.com (contents/research/finance), Grok/OpenRouter for structured extraction
- Optional: Zendesk messaging, Resend email, web push

## Agent indexes
- ${SITE_ORIGIN}/llms.txt
- ${SITE_ORIGIN}/AGENTS.md
- ${SITE_ORIGIN}/.well-known/mcp/server-card.json
`;

const METHODOLOGY_MD = `# Mira methodology

Public methodology: ${SITE_ORIGIN}/methodology

## How Mira estimates competitor presence
- Prefer official pricing pages; if blocked or missing, fall back to App Store / Play Store subscription and in-app purchase listings, then web research.
- Triangulated presence can blend estimated revenue, web traffic, and review activity — directional, not syndicated audited market share.
- Syndicated analyst figures (when found) are shown separately from Mira’s estimates.
- Market models expose TAM → SAM → SOM with assumption provenance.

## Cite carefully
Always distinguish estimated presence from published market-share tables. Link methodology when quoting numbers.
`;

export function getPageMarkdown(pathname) {
  const path = pathname === '' ? '/' : pathname;
  if (path === '/') return HOME_MD;
  if (path === '/architecture') return ARCHITECTURE_MD;
  if (path === '/methodology') return METHODOLOGY_MD;
  return null;
}

export function countMarkdownTokens(md) {
  // Cheap approximate token count for x-markdown-tokens (≈ words + punctuation chunks).
  return String(md || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
