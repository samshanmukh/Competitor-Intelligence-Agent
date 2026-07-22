'use client';

import { useEffect } from 'react';

const KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY || '';
const SCRIPT_ID = 'ze-snippet';

/** Calm light Mira surfaces for Zendesk messenger (colors only). */
const MIRA_THEME = {
  theme: {
    primary: '#5C6B52',
    onPrimary: '#ffffff',
    message: '#EFEEEA',
    onMessage: '#1C1917',
    businessMessage: '#FFFFFF',
    onBusinessMessage: '#1C1917',
    action: '#5C6B52',
    onAction: '#ffffff',
    background: '#F6F4F0',
    onBackground: '#57534E',
    conversationListBackground: '#FFFFFF',
    onConversationListBackground: '#1C1917',
    error: '#e11d48',
    onError: '#ffffff',
    notify: '#5C6B52',
    onNotify: '#ffffff',
    onSecondaryAction: '#5C6B52',
  },
  common: {
    stylingPreset: 'minimalistic',
    contentScale: 100,
  },
  messageLog: {
    avatar: {
      position: 'top',
      size: 28,
    },
  },
  position: {
    side: 'right',
    offset: {
      web: { horizontal: 20, vertical: 20 },
      mobile: { horizontal: 16, vertical: 16 },
    },
  },
};

function zECall(...args) {
  if (typeof window === 'undefined' || typeof window.zE !== 'function') return;
  try {
    window.zE(...args);
  } catch {
    // Widget not ready yet
  }
}

function messenger(cmd, ...args) {
  zECall('messenger', cmd, ...args);
}

function applyMiraStyle() {
  zECall('messenger:set', 'customization', MIRA_THEME);
  zECall('messenger:set', 'zIndex', 40);
}

/**
 * Zendesk Messaging / AI agent Web Widget for signed-in app pages.
 * Colors are applied via messenger:set customization (page-level override).
 */
export default function ZendeskWidget() {
  useEffect(() => {
    if (!KEY) return undefined;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      applyMiraStyle();
      messenger('show');
      return () => messenger('hide');
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${encodeURIComponent(KEY)}`;
    script.onload = () => {
      applyMiraStyle();
      messenger('show');
      window.setTimeout(applyMiraStyle, 400);
    };
    document.body.appendChild(script);

    return () => messenger('hide');
  }, []);

  return null;
}

export function isZendeskEnabled() {
  return Boolean(KEY);
}
