import MarketModelClient from '../../components/MarketModelClient';

export const metadata = {
  title: 'Market model',
  description: 'Build a sourced TAM, SAM, and SOM model for your market.',
};

export default function MarketPage() {
  return <MarketModelClient />;
}
