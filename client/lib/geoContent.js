/**
 * Shared GEO (Generative Engine Optimization) content for Mira.
 * Used by homepage SSR guide, FAQ page, and JSON-LD builders.
 */

export const SITE_ORIGIN = 'https://www.joinmira.ai';

export const AUTHOR = {
  name: 'Sam Karri',
  jobTitle: 'Founder',
  email: 'support@joinmira.ai',
  url: `${SITE_ORIGIN}/about`,
};

export const ORG = {
  name: 'Mira',
  legalName: 'Mira AI',
  foundingDate: '2025-01-15',
  email: 'support@joinmira.ai',
  description:
    'Mira is competitive and market intelligence software for founders. It turns business, market, and competitor signals into decision support for pricing, positioning, and the next move.',
};

/** Visible FAQ entries — keep in sync with FAQPage JSON-LD (need 5+; prefer 8–12). */
export const FAQS = [
  {
    question: 'What is Mira?',
    answer:
      'Mira is competitive and market intelligence software for founders at joinmira.ai, founded on 2025-01-15. Paste a product URL and Mira targets a first clarity snapshot in about 2 minutes: competitor discovery, pricing extraction (website plus App Store / Google Play when needed), feature and value matrices, TAM/SAM/SOM sizing, presence estimates, battlecards, and investor-ready briefs. Support: support@joinmira.ai.',
  },
  {
    question: 'What is competitive intelligence for startups?',
    answer:
      'Competitive intelligence for startups is the systematic collection and interpretation of rival and market signals so founders can decide pricing, positioning, features, and go-to-market moves. Unlike enterprise CI platforms built for 10–100 seat research orgs, startup CI tools like Mira prioritize URL-driven discovery and decision-ready outputs in minutes rather than multi-week analyst retainers that can cost $5,000–$25,000+.',
  },
  {
    question: 'How does Mira estimate competitor presence?',
    answer:
      'Mira prefers official pricing and product pages (evidence grade A). When those are blocked or missing, it falls back to App Store and Google Play listings (grade B), then named secondary research (grade C), then triangulated models blending estimated revenue clues, web traffic proxies, and review activity (grade D). D-grade figures are directional — never labeled as audited % market share. See /methodology.',
  },
  {
    question: 'How is Mira different from Crayon, Klue, or Similarweb?',
    answer:
      'Crayon and Klue are enterprise battlecard / enablement platforms for sales and PMM teams. Similarweb emphasizes traffic and digital share panels. Mira is built for early-stage founders: start from a product URL, produce pricing and feature matrices, TAM→SAM→SOM (so a $1,000,000,000 TAM is not confused with a $10,000,000 SOM — a 100× gap), and next-move recommendations without a CI ops team.',
  },
  {
    question: 'Does Mira scrape App Store and Google Play pricing?',
    answer:
      'Yes. When a competitor lacks a clear website pricing page, Mira can discover App Store and Google Play listings and extract subscription and in-app purchase price points — commonly in the $0–$99/month consumer SaaS band — and retain source links. Annual plans often advertise roughly 17%–20% off monthly run-rate (“2 months free”).',
  },
  {
    question: 'What is TAM, SAM, and SOM in Mira?',
    answer:
      'TAM (Total Addressable Market) is the broad revenue opportunity if every potential customer bought. SAM (Serviceable Addressable Market) is the segment you can realistically reach. SOM (Serviceable Obtainable Market) is near-term capturable share given competition and capacity. Mira exposes assumption provenance for each of the 3 layers so pitch decks do not collapse them into one number.',
  },
  {
    question: 'Is Mira free to start?',
    answer:
      'You can create an account at joinmira.ai and start a workspace at $0 to begin. Live plan details and entitlements are shown in-app after signup. For product questions, email support@joinmira.ai.',
  },
  {
    question: 'Who should use Mira?',
    answer:
      'Solo founders, pre-seed and seed teams, indie hackers, and accelerator cohorts who need analyst-grade clarity without hiring a full research function. A practical default watchlist is 5–12 named competitors refreshed weekly (52×/year), not 100+ enterprise alert feeds.',
  },
  {
    question: 'How often should founders refresh competitive intelligence?',
    answer:
      'For seed-stage teams, Mira recommends a weekly cadence: Monday pricing/changelog deltas for your top 5–12 rivals; Wednesday one battlecard claim update; Friday one product or positioning decision. That is 52 structured refresh cycles per year instead of a single outdated slide deck.',
  },
  {
    question: 'Where can I find Mira’s FAQ, About, and Team pages?',
    answer:
      'FAQ: https://www.joinmira.ai/faq (also on the homepage under #faq). About: https://www.joinmira.ai/about. Team: https://www.joinmira.ai/team. Privacy: /privacy. Terms: /terms. Methodology: /methodology. Architecture: /architecture.',
  },
];

export const GUIDE_UPDATED = '2026-07-25';
export const GUIDE_PUBLISHED = '2025-11-01';

export const COMPARISON_ROWS = [
  {
    capability: 'Primary user',
    mira: 'Founders & early product teams',
    enterpriseCi: 'Sales / PMM / CI ops',
    trafficTools: 'Growth & SEO analysts',
  },
  {
    capability: 'Start from product URL',
    mira: 'Yes — discovery from your site',
    enterpriseCi: 'Usually manual competitor lists',
    trafficTools: 'Domain / category search',
  },
  {
    capability: 'Pricing matrix',
    mira: 'Website + App Store / Play fallback',
    enterpriseCi: 'Battlecards, often manual refresh',
    trafficTools: 'Limited / not core',
  },
  {
    capability: 'Feature & value scoring',
    mira: 'Automated matrices + value scores',
    enterpriseCi: 'Structured battlecards',
    trafficTools: 'Not primary',
  },
  {
    capability: 'Market sizing (TAM/SAM/SOM)',
    mira: 'Built-in with assumption provenance',
    enterpriseCi: 'Varies by workflow',
    trafficTools: 'Traffic-based proxies',
  },
  {
    capability: 'Presence / share estimates',
    mira: 'Triangulated, labeled directional',
    enterpriseCi: 'Win-loss & intel feeds',
    trafficTools: 'Panel / crawl traffic share',
  },
  {
    capability: 'Investor-ready briefs',
    mira: 'Yes',
    enterpriseCi: 'Enablement-focused',
    trafficTools: 'Dashboards, not briefs',
  },
];
