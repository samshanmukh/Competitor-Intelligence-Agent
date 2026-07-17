import CompetitorDetailClient from '../../../components/CompetitorDetailClient';

export const metadata = {
  title: 'Competitor details',
  description: 'Review competitor pricing, snapshots, and detected changes.',
};

export default async function CompetitorDetailPage({ params }) {
  const { id } = await params;
  return <CompetitorDetailClient id={id} />;
}
