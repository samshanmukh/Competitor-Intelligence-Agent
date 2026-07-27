import SeoLanderPage, { seoLanderMetadata } from '../../components/SeoLanderPage';

const SLUG = 'competitive-intelligence-software';

export const metadata = seoLanderMetadata(SLUG);

export default function Page() {
  return <SeoLanderPage slug={SLUG} />;
}
