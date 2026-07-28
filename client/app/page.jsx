import LandingPage from '../components/LandingPage';
import LandingProductDocs from '../components/LandingProductDocs';
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
 * Homepage: marketing landing + a short, always-visible product-docs section.
 * Dense GEO cornerstone (AgentReadableSummary + GeoGuide) lives on /guide —
 * GeoTest executes JS, so SSR-then-hide collapsed Quick Scan (~59).
 */
export default function Home() {
  return (
    <LandingPage>
      <LandingProductDocs />
    </LandingPage>
  );
}
