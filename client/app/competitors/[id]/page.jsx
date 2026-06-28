import CompetitorDetailClient from '../../../components/CompetitorDetailClient';

export const metadata = { title: 'Competitor' };

export default function CompetitorDetailPage({ params }) {
  return <CompetitorDetailClient id={params.id} />;
}
