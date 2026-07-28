import LandingPage from '../components/LandingPage';
import { pageMetadata } from '../lib/seo';
import { AUTHOR, GUIDE_PUBLISHED, GUIDE_UPDATED } from '../lib/geoContent';

const base = pageMetadata({
  title: 'Mira',
  absoluteTitle: 'Mira · Competitive and market intelligence for founders',
  description:
    'Competitive and market intelligence for founders: see your rivals, pricing, and market clearly, then know what to focus on next.',
  path: '/',
});

export const metadata = {
  ...base,
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: 'Mira',
  alternates: {
    ...base.alternates,
    types: {
      'text/html': [
        { url: '/faq', title: 'FAQ' },
        { url: '/about', title: 'About' },
        { url: '/team', title: 'Team' },
        { url: '/guide', title: 'Guide' },
        { url: '/contact', title: 'Contact' },
      ],
    },
  },
  other: {
    'article:published_time': GUIDE_PUBLISHED,
    'article:modified_time': GUIDE_UPDATED,
    author: AUTHOR.name,
  },
  openGraph: {
    ...base.openGraph,
    type: 'article',
    publishedTime: GUIDE_PUBLISHED,
    modifiedTime: GUIDE_UPDATED,
    authors: [AUTHOR.name],
  },
};

/**
 * Homepage: marketing landing only.
 * Long-form product docs live on /guide (LandingProductDocs + AgentReadableSummary).
 * No cloaking, GeoTest executes JS; a clean human homepage is the priority.
 */
export default function Home() {
  return <LandingPage />;
}
