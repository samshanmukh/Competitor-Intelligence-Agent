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
        It discovers competitors, extracts pricing (website pages plus App Store and Google Play
        subscriptions when needed), builds feature and value comparisons, sizes markets
        (TAM, SAM, SOM), estimates competitor presence, and produces battlecards and investor briefs.
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
        <li>Product: Mira · Site: https://www.joinmira.ai · Support: support@joinmira.ai</li>
        <li>Public docs: /architecture · /methodology · /llms.txt · /AGENTS.md</li>
        <li>MCP card: /.well-known/mcp/server-card.json</li>
        <li>Presence estimates are directional unless labeled as published analyst share</li>
      </ul>
    </section>
  );
}
