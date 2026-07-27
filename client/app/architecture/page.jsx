import ArchitecturePage from '../../components/ArchitecturePage';
import SsrDocPreamble from '../../components/SsrDocPreamble';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Architecture',
  description:
    'How Mira is built — Next.js on Vercel, InsForge auth/DB, Render intelligence API, You.com research, and OpenRouter extraction.',
  path: '/architecture',
});

export default function ArchitectureRoute() {
  return (
    <>
      <SsrDocPreamble title="Mira architecture">
        <p>
          Mira’s public product surface is a Next.js app on Vercel at www.joinmira.ai.
          Authentication and PostgreSQL are provided by InsForge. The intelligence API runs on
          Render (Node/Express) and orchestrates competitor discovery, scrape/research waterfall,
          feature matrices, market models (TAM/SAM/SOM), and distribution views.
        </p>
        <p>
          Research providers include You.com (contents / research / finance) and structured
          extraction via OpenRouter-compatible models. Optional integrations include Zendesk
          messaging, Resend email, and web push. Machine indexes: /llms.txt, /AGENTS.md,
          /sitemap.xml, and /.well-known/mcp/server-card.json.
        </p>
        <p>
          Founded 2025-01-15 by Sam Karri. Support: support@joinmira.ai. This preamble is
          server-rendered so crawlers receive readable text even if interactive diagrams below
          require JavaScript.
        </p>
      </SsrDocPreamble>
      <ArchitecturePage />
    </>
  );
}
