import { buildJsonLdGraph } from '../lib/agentContent';

/**
 * Raw JSON-LD script (not next/script) so crawlers see application/ld+json in HTML.
 * Place inside <head> in the root layout.
 */
export default function JsonLd({ pathname = '/' }) {
  const data = buildJsonLdGraph({ pathname });
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
