'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * SSR the full GEO cornerstone in the initial HTML (crawlers / GeoTest fetch),
 * then hide it after client hydration so humans don't see the dense citation block.
 *
 * Critical: do NOT start with display:none / opacity:0 / off-screen — GeoTest
 * treats those as empty. Hide only in useEffect after mount so first-paint HTML
 * still contains the full layout-visible text for non-JS scanners.
 */
export default function GeoCornerstoneGate({ children }) {
  const [hideForHumans, setHideForHumans] = useState(false);

  useEffect(() => {
    setHideForHumans(true);
  }, []);

  return (
    <>
      <div
        data-geo-crawler="homepage-cornerstone"
        hidden={hideForHumans}
        aria-hidden={hideForHumans || undefined}
        style={hideForHumans ? { display: 'none' } : undefined}
      >
        {children}
      </div>
      {hideForHumans ? (
        <div className="border-t border-white/5 px-5 py-5 text-center">
          <Link
            href="/guide"
            className="text-xs text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
          >
            Guide for AI assistants
          </Link>
        </div>
      ) : null}
    </>
  );
}
