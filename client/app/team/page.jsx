import PublicDocShell from '../../components/PublicDocShell';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { teamBody } from '../../lib/publicPageCopy';
import { AUTHOR, ORG } from '../../lib/geoContent';

export const metadata = {
  title: 'Team',
  description:
    'Mira team — founder Sam Karri, roles, and how to contact support@joinmira.ai for competitive intelligence software.',
  alternates: { canonical: '/team' },
};

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
