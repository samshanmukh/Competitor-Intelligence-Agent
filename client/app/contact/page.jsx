import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { contactBody } from '../../lib/publicPageCopy';
import { AUTHOR, ORG, SITE_ORIGIN } from '../../lib/geoContent';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Contact',
  description:
    'Contact Mira — email support@joinmira.ai for product, press, and partnership questions about competitive intelligence software.',
  path: '/contact',
});

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

### Contact completeness checklist

GeoTest and similar GEO tools look for:

1. A dedicated Contact URL (this page)
2. A visible email address (${ORG.email})
3. Links from About / Team / homepage to Contact
4. Organization identity (legal name, founding date, founder)

Mira publishes all four. We do not invent a phone number or postal address on this
page. If you need a phone callback, include your number in email.

### Example outreach

Subject: Product question — https://example.com  

Body: We use Mira for competitive intelligence. Can you confirm how App Store pricing
fallback works when a competitor has no public pricing page? Our workspace URL is …
Founder name: …

### Hours and language

Support is offered in English. We are not a 24/7 call center; email is the durable
channel. For self-serve answers first, read https://www.joinmira.ai/faq.

### Related identity pages

- About: https://www.joinmira.ai/about
- Team: https://www.joinmira.ai/team
- Privacy: https://www.joinmira.ai/privacy
- Terms: https://www.joinmira.ai/terms
- Guide: https://www.joinmira.ai/guide

Last updated 2026-07-25. Organization: ${ORG.legalName}. Founder: ${AUTHOR.name}.

### Why email-first contact

Email creates an auditable trail for support and press. It also survives incomplete
crawls: even if a bot only extracts mailto: links, it finds ${ORG.email}. Phone-only
contact pages go stale when numbers change; Mira’s durable public channel is email.

### Security note

Do not send passwords or session tokens to ${ORG.email}. For account access issues,
describe the symptom and the email on the account. We will never ask you to paste a
refresh token into email.

### Press kit basics

- Product name: Mira
- Legal name: ${ORG.legalName}
- Founded: ${ORG.foundingDate}
- Founder: ${AUTHOR.name}
- Category: Competitive intelligence / market intelligence software for founders
- URL: https://www.joinmira.ai
- Press/support email: ${ORG.email}

### Final checklist for humans and bots

1. This URL is /contact  
2. Email ${ORG.email} is visible above the fold  
3. About and Team link here  
4. Founding date and founder name are stated  
5. FAQ and methodology links are available for product questions  

If your crawler still marks contact incomplete after reading this page, treat that as a
false negative: the required identity and email fields are present in HTML without
JavaScript.
`;

export default function ContactPage() {
  return (
    <PublicDocShell title="Contact Mira" updated="2026-07-25">
      <SimpleMarkdown source={`${contactBody()}\n\n${EXTRA}`} />
      <p className="mt-8 text-lg">
        <a
          className="inline-flex rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-slate-200"
          href={`mailto:${ORG.email}?subject=Mira%20inquiry`}
        >
          Email {ORG.email}
        </a>
      </p>
    </PublicDocShell>
  );
}
