import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { termsBody } from '../../lib/publicPageCopy';
import { ORG } from '../../lib/geoContent';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'Terms of service for Mira competitive intelligence software at joinmira.ai.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <PublicDocShell title="Terms of Service" updated="2026-07-25">
      <SimpleMarkdown source={termsBody()} />
      <p className="mt-8 text-sm text-slate-400">
        Contact: <a className="text-indigo-300 underline-offset-2 hover:underline" href={`mailto:${ORG.email}`}>{ORG.email}</a>
      </p>
    </PublicDocShell>
  );
}
