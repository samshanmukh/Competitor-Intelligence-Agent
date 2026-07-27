import SeoLanderPage, { seoLanderMetadata } from '../../components/SeoLanderPage';

const SLUG = 'competitor-pricing-analysis';

export const metadata = seoLanderMetadata(SLUG);

export default function Page() {
  return <SeoLanderPage slug={SLUG} />;
}
