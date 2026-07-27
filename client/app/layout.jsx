import './globals.css';
import { Inter, Nunito } from 'next/font/google';
import { ToastProvider } from '../components/ui';
import AppShell from '../components/AppShell';
import JsonLd from '../components/JsonLd';
import { DEFAULT_OG_IMAGE } from '../lib/seo';

const inter = Inter({ subsets: ['latin'] });
// Rounded brand wordmark — matches Mira logo type.
const brand = Nunito({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-brand' });

export const metadata = {
  title: { default: 'Mira', template: '%s · Mira' },
  description: 'Competitive and market intelligence for founders, with decision support for what to do next.',
  metadataBase: new URL('https://www.joinmira.ai'),
  // Do NOT set a root canonical to "/" — it made /login (and other pages) claim the homepage URL.
  alternates: {
    types: {
      'text/markdown': [{ url: '/', title: 'Mira (Markdown)' }],
      'text/plain': [{ url: '/llms.txt', title: 'llms.txt' }],
    },
  },
  icons: {
    icon: [{ url: '/mira-mark.svg?v=3', type: 'image/svg+xml' }],
    apple: [{ url: '/mira-mark.svg?v=3' }],
  },
  openGraph: {
    title: 'Mira · Competitive and market intelligence for founders',
    description: 'Turn business, market, and competitor signals into decision support for your next move.',
    url: 'https://www.joinmira.ai',
    siteName: 'Mira',
    type: 'website',
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Mira — competitive and market intelligence for founders',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mira · Competitive and market intelligence for founders',
    description: 'Turn business, market, and competitor signals into decision support for your next move.',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Explicit <head> JSON-LD — GeoTest Quick Scan checks homepage <head> for Organization/WebSite. */}
        <JsonLd pathname="/" />
        <link rel="help" href="https://www.joinmira.ai/faq" title="FAQ" />
        <link rel="author" href="https://www.joinmira.ai/about" title="About Mira" />
        {/* GeoTest domain verification (from geotest.ai ownership challenge). */}
        <meta name="geotest-verify" content="8635076a-3f64-436d-bdcd-c8c73c701b67" />
      </head>
      <body className={`${inter.className} ${brand.variable}`}>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
