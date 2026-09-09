import Link from 'next/link';
import PublicDocShell from './PublicDocShell';
import SimpleMarkdown from './SimpleMarkdown';
import { getSeoLander } from '../lib/seoLanders';
import { pageMetadata } from '../lib/seo';
import { notFound } from 'next/navigation';

export function seoLanderMetadata(slug) {
  const lander = getSeoLander(slug);
  if (!lander) return {};
  return pageMetadata({
    title: lander.title,
    description: lander.description,
    path: `/${lander.slug}`,
  });
}

export default function SeoLanderPage({ slug }) {
  const lander = getSeoLander(slug);
  if (!lander) notFound();

  return (
    <PublicDocShell title={lander.h1} updated={lander.updated}>
      <p className="text-slate-300">{lander.description}</p>
      <p className="mt-4">
        <Link href="/app" className="font-semibold text-indigo-300 underline-offset-2 hover:underline">
          Start with Mira
        </Link>
        {' · '}
        <Link href="/guide" className="text-indigo-300 underline-offset-2 hover:underline">
          Read the full guide
        </Link>
      </p>
      {lander.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-xl font-semibold text-white">{section.heading}</h2>
          <div className="mt-3">
            <SimpleMarkdown source={section.body} />
          </div>
        </section>
      ))}
    </PublicDocShell>
  );
}
