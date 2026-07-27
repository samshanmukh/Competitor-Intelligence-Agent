import SeoLanderPage, { seoLanderMetadata } from '../../components/SeoLanderPage';

const SLUG = 'find-saas-competitors';

export const metadata = seoLanderMetadata(SLUG);

export default function Page() {
  return <SeoLanderPage slug={SLUG} />;
}
