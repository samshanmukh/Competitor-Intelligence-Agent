import LandingPage from '../components/LandingPage';
import AgentReadableSummary from '../components/AgentReadableSummary';
import GeoGuide from '../components/GeoGuide';
import { pageMetadata } from '../lib/seo';
import { AUTHOR, GUIDE_PUBLISHED, GUIDE_UPDATED } from '../lib/geoContent';

const base = pageMetadata({
  title: 'Mira',
  absoluteTitle: 'Mira · Competitive and market intelligence for founders',
  description:
    'Competitive and market intelligence for founders — discover competitors, analyze pricing (web + App Store / Play), size TAM/SAM/SOM, and get next-move decision support in about 2 minutes.',
  path: '/',
});

export const metadata = {
  ...base,
  alternates: {
    ...base.alternates,
    types: {
      'text/html': [
        { url: '/faq', title: 'FAQ' },
        { url: '/about', title: 'About' },
        { url: '/guide', title: 'Guide' },
      ],
    },
  },
  other: {
    'article:published_time': GUIDE_PUBLISHED,
    'article:modified_time': GUIDE_UPDATED,
  },
  openGraph: {
    ...base.openGraph,
    type: 'article',
    publishedTime: GUIDE_PUBLISHED,
    modifiedTime: GUIDE_UPDATED,
    authors: [AUTHOR.name],
  },
};

export default function Home() {
  return (
    <LandingPage>
      {/*
        GeoTest only counts layout-visible text (not opacity:0 / off-screen clip).
        Keep the cornerstone AFTER the marketing sections so the hero stays clean,
        but still fully visible in the page so Content / Citation / Authority score.
      */}
      <div data-geo-crawler="homepage-cornerstone">
        <AgentReadableSummary />
        <GeoGuide />
      </div>
    </LandingPage>
  );
}
