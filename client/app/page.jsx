import LandingPage from '../components/LandingPage';

export const metadata = {
  title: { absolute: 'Mira · Competitive and market intelligence for founders' },
  description:
    'Competitive and market intelligence for founders, turning business and competitor signals into decision support for the next move.',
  alternates: { canonical: '/' },
};

export default function Home() {
  return <LandingPage />;
}
