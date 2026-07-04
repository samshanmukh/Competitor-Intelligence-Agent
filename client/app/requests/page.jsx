import FeatureRequestsClient from '../../components/FeatureRequestsClient';

export const metadata = {
  title: 'Feature requests · Mira Intelligence',
  description: 'Vote on what Mira Intelligence builds next, or submit your own request.',
};

export default function RequestsPage() {
  return <FeatureRequestsClient />;
}
