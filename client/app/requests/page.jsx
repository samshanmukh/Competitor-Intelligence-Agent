import FeatureRequestsClient from '../../components/FeatureRequestsClient';

export const metadata = {
  title: 'Feature requests · Mira Vue',
  description: 'Vote on what Mira Vue builds next, or submit your own request.',
};

export default function RequestsPage() {
  return <FeatureRequestsClient />;
}
