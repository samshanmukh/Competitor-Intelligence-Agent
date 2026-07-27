import MethodologyClient from '../../components/MethodologyClient';
import SsrDocPreamble from '../../components/SsrDocPreamble';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Methodology',
  description:
    'How Mira estimates competitor presence and market size — evidence grades A–D, App Store fallbacks, and TAM/SAM/SOM provenance.',
  path: '/methodology',
});

export default function MethodologyRoute() {
  return (
    <>
      <SsrDocPreamble title="Mira methodology">
        <p>
          Mira prefers official pricing and product pages (evidence grade A). When those are
          blocked or missing, it falls back to Apple App Store and Google Play listings (grade B),
          then named secondary research (grade C), then triangulated models that may blend
          estimated revenue clues, web traffic proxies, and review activity (grade D).
        </p>
        <p>
          Grade D presence figures are directional — not audited market share. Market models expose
          TAM → SAM → SOM with assumption provenance so a $1,000,000,000 category claim is not
          confused with a $10,000,000 near-term obtainable segment (a 100× gap).
        </p>
        <p>
          Always distinguish estimated presence from published analyst tables when citing Mira.
          Support: support@joinmira.ai. About / Team: /about and /team. Updated 2026-07-25.
        </p>
      </SsrDocPreamble>
      <MethodologyClient />
    </>
  );
}
