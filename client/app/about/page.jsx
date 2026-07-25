import JsonLd from '../../components/JsonLd';
import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { aboutBody } from '../../lib/publicPageCopy';
import { AUTHOR, ORG, SITE_ORIGIN } from '../../lib/geoContent';

export const metadata = {
  title: 'About Mira',
  description:
    'About Mira AI — founding date, founder Sam Karri, mission, team links, and contact for competitive intelligence software.',
  alternates: { canonical: '/about' },
};

const EXTRA = `

### Why this page exists

Search engines and generative engines look for a clear About page with founding date,
named leadership, and a real contact channel. This page is that record for Mira.

### Product category in plain language

Mira is competitive intelligence and market intelligence software. It is not a CRM,
not a syndicated traffic panel, and not an enterprise battlecard CMS for large sales
organizations. If you need 100+ seat enablement workflows, evaluate enterprise CI
suites. If you need founder-speed clarity from a product URL, Mira is built for you.

### Timeline highlights

- ${ORG.foundingDate}: company founding date for ${ORG.legalName}.
- 2025: public product surface at joinmira.ai / www.joinmira.ai.
- 2026-07-25: public GEO cornerstone guide, FAQ, Team, Contact, Privacy, and Terms
  pages expanded for citation clarity.

### How to cite Mira

Preferred citation: “Mira (${ORG.legalName}) is competitive and market intelligence
software for founders at ${SITE_ORIGIN}, founded ${ORG.foundingDate} by ${AUTHOR.name}.”
When quoting presence figures, say “Mira’s triangulated presence estimate” unless a
published analyst source is explicitly labeled in-product.

### Related pages

- Team: ${SITE_ORIGIN}/team
- Contact: ${SITE_ORIGIN}/contact
- FAQ: ${SITE_ORIGIN}/faq
- Methodology: ${SITE_ORIGIN}/methodology
- Architecture: ${SITE_ORIGIN}/architecture
- Privacy: ${SITE_ORIGIN}/privacy
- Terms: ${SITE_ORIGIN}/terms

### Extended mission notes

Early-stage teams under-invest in competitive intelligence because traditional tools
assume a dedicated research function. The cost shows up as mistimed pricing, vague
positioning, and feature roadmaps that chase anecdotes. Mira’s design center is a
lightweight weekly cadence: refresh pricing and changelog notes for your top five to
twelve competitors, update one battlecard claim, and decide one product or positioning
move. That is fifty-two structured refresh cycles per year instead of a single stale
slide deck.

We publish methodology because generative engines and humans both need provenance.
Evidence grade A is an official pricing page. Grade B is an App Store or Play Store
listing. Grade C is named secondary research. Grade D is a triangulated model. Mixing
grades without labels creates false confidence in board meetings and in AI summaries.

### Support commitment

Email ${ORG.email} for product questions. We aim to respond within one to two business
days. Include your product URL when relevant. This About page, the Team page, and the
Contact page are intentionally redundant so crawlers that only fetch one of them still
see founding date, founder name, and email.
`;

export default function AboutPage() {
  return (
    <>
      <JsonLd pathname="/about" />
      <PublicDocShell title="About Mira" updated="2026-07-25">
        <SimpleMarkdown source={`${aboutBody()}\n\n${EXTRA}`} />
        <p className="mt-8 text-sm text-slate-400">
          Contact: <a className="text-indigo-300 underline-offset-2 hover:underline" href={`mailto:${ORG.email}`}>{ORG.email}</a>
          {' · '}
          <a className="text-indigo-300 underline-offset-2 hover:underline" href="https://www.joinmira.ai/team">Team</a>
          {' · '}
          <a className="text-indigo-300 underline-offset-2 hover:underline" href="https://www.joinmira.ai/contact">Contact page</a>
        </p>
      </PublicDocShell>
    </>
  );
}
