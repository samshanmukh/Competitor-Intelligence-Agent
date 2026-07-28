/**
 * Shared metadata helpers for public marketing pages.
 * Keeps canonical + Open Graph + Twitter aligned per URL.
 */

export const SITE_ORIGIN = 'https://www.joinmira.ai';
export const DEFAULT_OG_IMAGE = '/og-default.png';

/**
 * @param {{ title: string, description: string, path: string, absoluteTitle?: string, type?: string }} opts
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle,
  type = 'website',
}) {
  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const pageUrl = urlPath === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${urlPath}`;
  const ogTitle = absoluteTitle || `${title} · Mira`;

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: urlPath },
    openGraph: {
      title: ogTitle,
      description,
      url: pageUrl,
      siteName: 'Mira',
      type,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: 'Mira: competitive and market intelligence for founders',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

/** Auth / thin shells, keep out of the index. */
export const NOINDEX = {
  robots: { index: false, follow: false },
};
