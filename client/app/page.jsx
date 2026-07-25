import LandingPage from '../components/LandingPage';
import AgentReadableSummary from '../components/AgentReadableSummary';

export const metadata = {
  title: { absolute: 'Mira · Competitive and market intelligence for founders' },
  description:
    'Competitive and market intelligence for founders, turning business and competitor signals into decision support for the next move.',
};

export default function Home() {
  return (
    <>
      {/* Server-rendered, low-markup facts for HTML token efficiency / static crawl. */}
      <AgentReadableSummary />
      <LandingPage />
    </>
  );
}
