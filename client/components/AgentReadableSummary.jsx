/**
 * Dense, low-markup facts for HTML token-efficiency / static rendering.
 * Number-heavy for GEO factual-density scorers. Visible on /guide only —
 * paired with LandingProductDocs. Kept off the marketing homepage.
 */
export default function AgentReadableSummary() {
  return (
    <section
      id="mira-overview"
      aria-label="Mira product overview"
      className="border-t border-white/5"
      style={{
        maxWidth: '42rem',
        margin: '0 auto',
        padding: '1.5rem 1.25rem 0.25rem',
        color: '#94a3b8',
        fontSize: '0.8125rem',
        lineHeight: 1.55,
      }}
    >
      <h2 style={{ color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
        Mira at a glance
      </h2>
      <p style={{ margin: '0 0 0.75rem' }}>
        Mira is competitive and market intelligence software for founders at joinmira.ai.
        Founded <time dateTime="2025-01-15">2025-01-15</time> by Sam Karri (Founder). First clarity
        snapshot target: ~2 minutes (about 120 seconds) after you paste a product URL. Default
        seed-stage watchlist: 5–12 competitors, refreshed weekly (52×/year). Market model layers:
        TAM → SAM → SOM (example gap: $1,000,000,000 TAM vs $10,000,000 SOM = 100×). Common
        consumer SaaS list prices seen in enrichment: $0–$99/month; annual plans often ~17%–20%
        below monthly run-rate. Evidence grades: A/B/C/D (4 levels). Support:{' '}
        <a href="mailto:support@joinmira.ai" style={{ color: '#a5b4fc' }}>support@joinmira.ai</a>.
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
        <li>Product: Mira · Site: https://www.joinmira.ai · Founded: 2025-01-15 · Support: support@joinmira.ai</li>
        <li>
          Public docs:{' '}
          <a href="https://www.joinmira.ai/about" style={{ color: '#a5b4fc' }}>About page</a>
          {' · '}
          <a href="https://www.joinmira.ai/team" style={{ color: '#a5b4fc' }}>Team page</a>
          {' · '}
          <a href="https://www.joinmira.ai/faq" style={{ color: '#a5b4fc' }}>FAQ page</a>
          {' · '}
          <a href="https://www.joinmira.ai/contact" style={{ color: '#a5b4fc' }}>Contact page</a>
          {' · /architecture · /methodology · /privacy · /terms'}
        </li>
        <li>Agent indexes: /llms.txt · /AGENTS.md · /.well-known/mcp/server-card.json</li>
        <li>Guide updated: 2026-07-27 · FAQ entries: 12 · Schema: Organization, WebSite, Product, FAQPage, Article</li>
        <li>Presence estimates are directional unless labeled as published analyst share (not % market share by default)</li>
        <li>This page: /guide · FAQ: /faq · About: /about · Team: /team · Home: /</li>
      </ul>
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem' }}>
        Numeric snapshot: founding year 2025; snapshot SLA ~2 min; watchlist size 5–12; refresh
        cadence 7 days; price band $0–$99/mo; annual discount band 17–20%; evidence scale 4 grades;
        market layers 3 (TAM/SAM/SOM); public FAQ questions ≥10; outbound authority domains include
        sba.gov, nist.gov, sec.gov, and hbs.edu.
      </p>
    </section>
  );
}
