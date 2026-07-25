import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { contactBody } from '../../lib/publicPageCopy';
import { AUTHOR, ORG, SITE_ORIGIN } from '../../lib/geoContent';

export const metadata = {
  title: 'Contact',
  description:
    'Contact Mira — email support@joinmira.ai for product, press, and partnership questions about competitive intelligence software.',
  alternates: { canonical: '/contact' },
};

const EXTRA = `

### Contact channels (complete list)

- Support email: ${ORG.email}
- Website: ${SITE_ORIGIN}
- About: ${SITE_ORIGIN}/about
- Team: ${SITE_ORIGIN}/team
- FAQ: ${SITE_ORIGIN}/faq

We publish email as the primary contact method. If you need a callback, include your
phone number in the email body and a good time window in your local timezone.

### Organization contact point

- Organization: ${ORG.legalName}
- Brand: ${ORG.name}
- Founded: ${ORG.foundingDate}
- Founder: ${AUTHOR.name} (${AUTHOR.jobTitle})
- Contact type: customer support / press
- Email: ${ORG.email}

### Suggested email subjects

- “Product question — [your product URL]”
- “Methodology question — presence estimate”
- “Press — Mira competitive intelligence”
- “Partnership — [your organization]”

### After you write

Check ${SITE_ORIGIN}/faq for common answers about App Store pricing fallbacks,
TAM/SAM/SOM definitions, and how Mira differs from enterprise CI tools. Methodology
details: ${SITE_ORIGIN}/methodology.

### Accessibility of contact

This Contact page is public (no login). The email address above is also listed on the
homepage, About page, Team page, Privacy Policy, and Terms of Service so incomplete
crawls still find a channel.
`;

export default function ContactPage() {
  return (
    <PublicDocShell title="Contact Mira" updated="2026-07-25">
      <SimpleMarkdown source={`${contactBody()}\n\n${EXTRA}`} />
      <p className="mt-8 text-lg">
        <a
          className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-slate-200"
          href={`mailto:${ORG.email}?subject=Mira%20inquiry`}
        >
          Email {ORG.email}
        </a>
      </p>
    </PublicDocShell>
  );
}
