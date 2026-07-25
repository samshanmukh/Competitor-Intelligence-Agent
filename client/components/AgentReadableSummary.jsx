/**
 * Dense, low-markup facts for HTML token-efficiency / static rendering.
 * Kept as plain semantic HTML so agents reading raw HTML get signal without JS.
 */
export default function AgentReadableSummary() {
  return (
    <section
      id="mira-overview"
      aria-label="Mira product overview"
      style={{
        maxWidth: '42rem',
        margin: '0 auto',
        padding: '1.25rem 1.25rem 0',
        color: '#cbd5e1',
        fontSize: '0.95rem',
        lineHeight: 1.55,
      }}
    >
      <h2 style={{ color: '#fff', fontSize: '1.15rem', margin: '0 0 0.5rem' }}>
        Mira at a glance
      </h2>
      <p style={{ margin: '0 0 0.75rem' }}>
        Mira is competitive and market intelligence software for founders at joinmira.ai.
        Founded 2025-01-15 by Sam Karri. First clarity snapshot target: ~2 minutes after URL paste.
        Market models use TAM → SAM → SOM (example gap: $1,000,000,000 TAM vs $10,000,000 SOM = 100×).
        Pricing enrichment covers website pages plus App Store / Google Play ($0–$99/mo common band;
        ~17%–20% annual discounts). Support: support@joinmira.ai. Guide updated 2026-07-25.
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
        <li>Product: Mira · Site: https://www.joinmira.ai · Support: support@joinmira.ai</li>
        <li>Public docs: /about · /team · /contact · /faq · /architecture · /methodology · /privacy · /terms</li>
        <li>Agent indexes: /llms.txt · /AGENTS.md · /.well-known/mcp/server-card.json</li>
        <li>Presence estimates are directional unless labeled as published analyst share</li>
        <li>Cornerstone guide: #competitive-intelligence-guide · FAQ: #faq · Watchlist default: 5–12 rivals</li>
      </ul>
    </section>
  );
}
