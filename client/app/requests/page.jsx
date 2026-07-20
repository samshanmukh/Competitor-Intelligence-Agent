import FeatureRequestsClient from '../../components/FeatureRequestsClient';

export const metadata = {
  title: 'Feature requests',
  description: 'Vote on what Mira AI builds next, or submit your own request.',
};

export default function RequestsPage() {
  return <FeatureRequestsClient />;
}
