const SITE = 'https://www.joinmira.ai';

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/architecture`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/llms.txt`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/AGENTS.md`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
