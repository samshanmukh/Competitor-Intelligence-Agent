import CompanyDeepDiveClient from '../../components/CompanyDeepDiveClient';

export const metadata = {
  title: 'Deep market search',
  description: 'Research a company’s business, financials, market model, traffic, and customer reviews with You.com.',
};

export default function CompanyPage() {
  return <CompanyDeepDiveClient />;
}
