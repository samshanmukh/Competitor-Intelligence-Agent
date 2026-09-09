import AgentReadableSummary from '../../components/AgentReadableSummary';
import LandingProductDocs from '../../components/LandingProductDocs';
import JsonLd from '../../components/JsonLd';
import Link from 'next/link';
import BrandLogo from '../../components/BrandLogo';
import { pageMetadata } from '../../lib/seo';

const GUIDE_META = pageMetadata({
  title: 'Competitive intelligence guide',
  description:
    'Founder guide to competitive and market intelligence: definitions, Mira vs enterprise CI tools, pricing research, TAM/SAM/SOM, and FAQ.',
  path: '/guide',
  type: 'article',
});

export const metadata = {
  ...GUIDE_META,
  openGraph: {
    ...GUIDE_META.openGraph,
    publishedTime: '2025-11-01',
    modifiedTime: '2026-07-27',
    authors: ['Sam Karri'],
  },
};

export default function GuidePage() {
  return (
    <>
      <JsonLd pathname="/guide" />
      <div className="min-h-screen bg-ink-950">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <BrandLogo href="/" height={28} />
            <Link href="/app" className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-ink-950 hover:bg-slate-200">
              Open app
            </Link>
          </div>
        </header>
        <AgentReadableSummary />
        <LandingProductDocs />
      </div>
    </>
  );
}
