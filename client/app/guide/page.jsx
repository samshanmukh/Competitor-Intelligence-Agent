import AgentReadableSummary from '../../components/AgentReadableSummary';
import GeoGuide from '../../components/GeoGuide';
import JsonLd from '../../components/JsonLd';
import Link from 'next/link';
import BrandLogo from '../../components/BrandLogo';
import { pageMetadata } from '../../lib/seo';

const GUIDE_META = pageMetadata({
  title: 'Competitive intelligence guide',
  description:
    'Founder guide to competitive and market intelligence — definitions, Mira vs enterprise CI tools, pricing research, TAM/SAM/SOM, and FAQ.',
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
            <nav className="flex items-center gap-4 text-sm text-slate-400">
              <Link href="/faq" className="hover:text-white">FAQ</Link>
              <Link href="/about" className="hover:text-white">About</Link>
              <Link href="/competitive-intelligence-software" className="hover:text-white">CI software</Link>
              <Link href="/" className="hover:text-white">Home</Link>
            </nav>
          </div>
        </header>
        <AgentReadableSummary />
        <GeoGuide />
      </div>
    </>
  );
}
