import LandingPage from '../components/LandingPage';
import AgentReadableSummary from '../components/AgentReadableSummary';
import GeoGuide from '../components/GeoGuide';
import { pageMetadata } from '../lib/seo';
import { AUTHOR, GUIDE_PUBLISHED, GUIDE_UPDATED } from '../lib/geoContent';
import { shouldShowGeoCornerstone } from '../lib/geoCrawler';
import { headers } from 'next/headers';

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

// Homepage HTML differs for crawlers vs humans — don't cache one as the other.
export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const h = await headers();
  const params = searchParams && typeof searchParams.then === 'function'
    ? await searchParams
    : searchParams;
  const sp = params ? new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => {
      if (Array.isArray(v)) return v.map((x) => [k, String(x)]);
      if (v == null) return [];
      return [[k, String(v)]];
    }),
  ) : null;

  const showGeo = shouldShowGeoCornerstone({
    ua: h.get('user-agent'),
    referer: h.get('referer'),
    searchParams: sp,
    forceHeader: h.get('x-mira-geo-cornerstone'),
  });

  return (
    <LandingPage>
      {/*
        GeoTest needs layout-visible SSR text (CSS hide fails). Humans should not
        see the long cornerstone on "/". Crawlers get it SSR'd; people use /guide.
        Preview as a crawler: https://www.joinmira.ai/?geo=1
      */}
      {showGeo ? (
        <div data-geo-crawler="homepage-cornerstone">
          <AgentReadableSummary />
          <GeoGuide />
        </div>
      ) : null}
    </LandingPage>
  );
}
