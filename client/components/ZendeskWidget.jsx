'use client';

import { useEffect } from 'react';

const KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY || '';
const SCRIPT_ID = 'ze-snippet';

function messenger(cmd, ...args) {
  if (typeof window === 'undefined' || typeof window.zE !== 'function') return;
  try {
    window.zE('messenger', cmd, ...args);
  } catch {
    // Widget not ready yet
  }
}

/**
 * Zendesk Messaging / AI agent Web Widget for signed-in app pages.
 * Key from Admin → Channels → Messaging → Web Widget → Installation.
 */
export default function ZendeskWidget() {
  useEffect(() => {
    if (!KEY) return undefined;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      messenger('show');
      return () => messenger('hide');
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${encodeURIComponent(KEY)}`;
    script.onload = () => messenger('show');
    document.body.appendChild(script);

    return () => messenger('hide');
  }, []);

  return null;
}

export function isZendeskEnabled() {
  return Boolean(KEY);
}
