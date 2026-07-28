import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { privacyBody } from '../../lib/publicPageCopy';
import { ORG } from '../../lib/geoContent';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'Privacy policy for Mira (joinmira.ai), how we handle account and product data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <PublicDocShell title="Privacy Policy" updated="2026-07-25">
      <SimpleMarkdown source={privacyBody()} />
      <p className="mt-8 text-sm text-slate-400">
        Contact: <a className="text-indigo-300 underline-offset-2 hover:underline" href={`mailto:${ORG.email}`}>{ORG.email}</a>
      </p>
    </PublicDocShell>
  );
}
