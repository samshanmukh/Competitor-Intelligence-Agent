import SeoLanderPage, { seoLanderMetadata } from '../../components/SeoLanderPage';

const SLUG = 'tam-sam-som';

export const metadata = seoLanderMetadata(SLUG);

export default function Page() {
  return <SeoLanderPage slug={SLUG} />;
}
