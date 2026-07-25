import { ORGANIZATION_JSON_LD } from '../lib/agentContent';

/** Server-safe JSON-LD for Organization / SoftwareApplication / WebSite. */
export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
    />
  );
}
