import LandingPage from '../components/LandingPage';
import JsonLd from '../components/JsonLd';
import { pageMetadata } from '../lib/seo';

export const metadata = pageMetadata({
  title: 'Mira',
  absoluteTitle: 'Mira · Competitive and market intelligence for founders',
  description:
    'Competitive and market intelligence for founders — discover competitors, analyze pricing (web + App Store / Play), size TAM/SAM/SOM, and get next-move decision support in about 2 minutes.',
  path: '/',
});

export default function Home() {
  return (
    <>
      <JsonLd pathname="/" />
      <LandingPage />
    </>
  );
}
