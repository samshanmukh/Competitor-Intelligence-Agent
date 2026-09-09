'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import SupportButton from './SupportButton';
import ZendeskWidget, { isZendeskEnabled } from './ZendeskWidget';

const NO_SHELL_PREFIXES = [
  '/requests',
  '/reports/shared',
  '/architecture',
];

/** Public marketing docs, no app sidebar (crawlable, shareable). */
const PUBLIC_DOC_EXACT = new Set([
  '/',
  '/about',
  '/team',
  '/contact',
  '/faq',
  '/guide',
  '/methodology',
  '/privacy',
  '/terms',
  '/competitive-intelligence-software',
  '/competitor-pricing-analysis',
  '/tam-sam-som',
  '/find-saas-competitors',
]);

function isPublicMarketing(pathname) {
  if (!pathname) return false;
  if (PUBLIC_DOC_EXACT.has(pathname)) return true;
  return NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const zendesk = isZendeskEnabled();

  // Landing and marketing docs render full-width without the app sidebar.
  const noShell = isPublicMarketing(pathname);

  // Marketing pages stay clean; Zendesk (or Help FAB) lives in the app.
  if (noShell) {
    return (
      <>
        {children}
      </>
    );
  }

  const isAnalysis = pathname === '/app';

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden md:h-dvh md:flex-row">
      <Sidebar />
      <main
        className={
          isAnalysis
            ? 'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:min-h-0'
            : 'relative min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10'
        }
      >
        {children}
      </main>
      {zendesk ? <ZendeskWidget /> : <SupportButton />}
    </div>
  );
}
