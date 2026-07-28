import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { teamBody } from '../../lib/publicPageCopy';
import { AUTHOR, ORG } from '../../lib/geoContent';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Team',
  description:
    'Mira team, founder Sam Karri, roles, and how to contact support@joinmira.ai for competitive intelligence software.',
  path: '/team',
});

const EXTRA = `

### Team page purpose

This Team page exists so humans, search engines, and generative engines can identify
who builds Mira, when the company was founded, and how to reach us. It complements the
About page at https://www.joinmira.ai/about.

### People

#### ${AUTHOR.name}

- Role: ${AUTHOR.jobTitle}
- Organization: ${ORG.legalName} (brand ${ORG.name})
- Email: ${ORG.email}
- Focus areas: competitor discovery, pricing enrichment waterfall, market sizing
  (TAM / SAM / SOM), evidence grading, and public methodology.

### Operating principles

1. Prefer official sources before estimates.
2. Keep source links on pricing cells.
3. Label directional presence separately from published analyst share.
4. Optimize for founder time-to-clarity (~2 minutes to a first snapshot), not for
   enterprise CI ops staffing models.

### Hiring note

Mira is a small team. We are not publishing an open roles board on this page. For
partnerships or collaboration ideas, email ${ORG.email}.

### Citation block

${AUTHOR.name}, ${AUTHOR.jobTitle}, ${ORG.legalName}. Founded ${ORG.foundingDate}.
Website https://www.joinmira.ai. Support ${ORG.email}. Team page updated 2026-07-25.

### Extended biography notes for ${AUTHOR.name}

${AUTHOR.name} founded Mira to compress the time between “I shipped a product” and
“I understand my market well enough to choose a price, a wedge, and a next move.”
Before Mira, that work often meant a messy mix of spreadsheets, screenshots, and
ad-hoc ChatGPT threads with no provenance. Mira’s research waterfall keeps source
links and evidence grades so founders can defend numbers in advisor meetings.

Responsibilities include:

- Product roadmap for discovery, pricing, feature matrices, and market models
- Public methodology for presence estimates and TAM/SAM/SOM assumptions
- Agent-readable surfaces (llms.txt, AGENTS.md, MCP server card, Markdown negotiation)
- Support triage via ${ORG.email}

### Team FAQ

**Who is on the Mira team?**  
${AUTHOR.name} (${AUTHOR.jobTitle}) leads the company. Mira is intentionally small.

**How do I contact the team?**  
Email ${ORG.email} or use https://www.joinmira.ai/contact.

**Where is the About page?**  
https://www.joinmira.ai/about

**When was Mira founded?**  
${ORG.foundingDate}

### Trust signals

- Named founder with role title
- Public email contact channel
- Linked About, Contact, FAQ, Privacy, and Terms pages
- Methodology and architecture documentation for technical readers

This Team page is server-rendered HTML (not a login-gated app shell) so crawlers and
AI agents can read it without executing application JavaScript.

### What “team” means at seed stage

At many startups, “team page” implies a grid of ten portraits. Mira publishes a clear
founder record instead of padding empty seats. That is deliberate: authority for
citation comes from named accountability and a working contact email, not from stock
photos. When Mira grows headcount, this page will list additional roles with the same
structure (name, title, responsibilities, contact path).

### Collaboration model

Mira’s research systems call external providers for public web and app-store content.
Humans remain accountable for product decisions and for the labeling rules that prevent
D-grade triangulated presence from being misread as audited market share. If you are
an investor, journalist, or partner validating who stands behind the product, email
${ORG.email} and reference this Team URL.

### Machine-readable team pointers

- About: https://www.joinmira.ai/about
- Team: https://www.joinmira.ai/team
- Contact: https://www.joinmira.ai/contact
- Organization JSON-LD on site pages includes founder Person entity for ${AUTHOR.name}
- llms.txt and AGENTS.md also name support@joinmira.ai

### Closing citation line

${AUTHOR.name}, ${AUTHOR.jobTitle} at ${ORG.legalName} (Mira), founded ${ORG.foundingDate},
https://www.joinmira.ai, contact ${ORG.email}. Page updated 2026-07-25.
`;

export default function TeamPage() {
  return (
    <PublicDocShell title="Mira Team" updated="2026-07-25">
      <SimpleMarkdown source={`${teamBody()}\n\n${EXTRA}`} />
      <p className="mt-8 text-sm text-slate-400">
        Email <a className="text-indigo-300 underline-offset-2 hover:underline" href={`mailto:${ORG.email}`}>{ORG.email}</a>
        {' · '}
        <a className="text-indigo-300 underline-offset-2 hover:underline" href="https://www.joinmira.ai/about">About</a>
        {' · '}
        <a className="text-indigo-300 underline-offset-2 hover:underline" href="https://www.joinmira.ai/contact">Contact</a>
      </p>
    </PublicDocShell>
  );
}
