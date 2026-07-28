import Link from 'next/link';
import JsonLd from '../../components/JsonLd';
import PublicDocShell from '../../components/PublicDocShell';
import { FAQS, GUIDE_UPDATED, ORG } from '../../lib/geoContent';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'FAQ',
  description:
    'Frequently asked questions about Mira competitive intelligence software, pricing research, market sizing, and how Mira compares to enterprise CI tools.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <>
      <JsonLd pathname="/faq" />
      <PublicDocShell title="Mira FAQ" updated={GUIDE_UPDATED}>
        <p>
          Answers about Mira competitive and market intelligence software. Full guide:{' '}
          <Link href="/guide" className="text-indigo-300 underline-offset-2 hover:underline">
            /guide
          </Link>
          . Topic pages:{' '}
          <Link href="/competitive-intelligence-software" className="text-indigo-300 underline-offset-2 hover:underline">
            CI software
          </Link>
          ,{' '}
          <Link href="/competitor-pricing-analysis" className="text-indigo-300 underline-offset-2 hover:underline">
            pricing analysis
          </Link>
          ,{' '}
          <Link href="/tam-sam-som" className="text-indigo-300 underline-offset-2 hover:underline">
            TAM/SAM/SOM
          </Link>
          ,{' '}
          <Link href="/find-saas-competitors" className="text-indigo-300 underline-offset-2 hover:underline">
            find competitors
          </Link>
          . Support: {ORG.email}.
        </p>
        <div className="mt-8 space-y-8">
          {FAQS.map((item) => (
            <div key={item.question}>
              <h2 className="text-lg font-semibold text-white">{item.question}</h2>
              <p className="mt-2 text-slate-300">{item.answer}</p>
            </div>
          ))}
        </div>
      </PublicDocShell>
    </>
  );
}
