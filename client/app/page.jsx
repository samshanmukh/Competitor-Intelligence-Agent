import LandingPage from '../components/LandingPage';
import AgentReadableSummary from '../components/AgentReadableSummary';
import GeoGuide from '../components/GeoGuide';

export const metadata = {
  title: { absolute: 'Mira · Competitive and market intelligence for founders' },
  description:
    'Mira is competitive and market intelligence software for founders. Discover competitors, extract pricing, size markets (TAM/SAM/SOM), and get decision support for your next move.',
  alternates: {
    canonical: '/',
    types: {
      'text/html': [
        { url: '/faq', title: 'FAQ' },
        { url: '/about', title: 'About' },
      ],
    },
  },
  other: {
    'article:published_time': '2025-11-01',
    'article:modified_time': '2026-07-25',
  },
  openGraph: {
    type: 'article',
    publishedTime: '2025-11-01',
    modifiedTime: '2026-07-25',
    authors: ['Sam Karri'],
  },
};

export default function Home() {
  return (
    <>
      {/* GEO cornerstone FIRST so crawlers that truncate HTML still see FAQ/stats/schema-backed copy. */}
      <AgentReadableSummary />
      <GeoGuide />
      <LandingPage />
    </>
  );
}
