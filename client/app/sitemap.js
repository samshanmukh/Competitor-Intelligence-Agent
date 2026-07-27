import { SEO_LANDERS } from '../lib/seoLanders';

const SITE = 'https://www.joinmira.ai';

export default function sitemap() {
  const now = new Date();
  const landers = SEO_LANDERS.map((l) => ({
    url: `${SITE}/${l.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.95,
  }));

  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...landers,
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/team`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/guide`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/architecture`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    // Intentionally omit /login and /signup — thin auth shells.
    { url: `${SITE}/llms.txt`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/AGENTS.md`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
