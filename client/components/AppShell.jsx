'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { consumeReturnPath } from '../lib/auth';
import Sidebar from './Sidebar';

const NO_SHELL_PREFIXES = ['/login', '/signup', '/verify', '/auth', '/requests', '/reports/shared', '/invite'];

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

  if (noShell) return children;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 min-w-0 px-5 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
