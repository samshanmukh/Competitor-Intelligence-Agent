'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { consumeReturnPath } from '../lib/auth';
import Sidebar from './Sidebar';
import SupportButton from './SupportButton';

const NO_SHELL_PREFIXES = ['/login', '/signup', '/verify', '/oauth', '/auth', '/requests', '/reports/shared', '/invite'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== '/app') return;
    const returnTo = consumeReturnPath();
    if (returnTo !== '/app') router.replace(returnTo);
  }, [pathname, router]);

  // Landing page (root) and auth pages render full-width without the app sidebar.
  const noShell = pathname === '/' || NO_SHELL_PREFIXES.some((p) => pathname?.startsWith(p));

  // Marketing + auth pages stay clean; help FAB lives in the signed-in app chrome.
  if (noShell) return children;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8">
        {children}
      </main>
      <SupportButton />
    </div>
  );
}
