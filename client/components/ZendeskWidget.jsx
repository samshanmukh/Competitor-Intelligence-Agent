'use client';

import { useEffect } from 'react';

const KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY || '';
const SCRIPT_ID = 'ze-snippet';

/** Dark Mira surfaces (ink + indigo). Zendesk only allows colors/layout knobs — not custom composer structure. */
const MIRA_THEME = {
  theme: {
    primary: '#6366f1',
    onPrimary: '#ffffff',
    message: '#212632',
    onMessage: '#e2e8f0',
    businessMessage: '#181c24',
    onBusinessMessage: '#e2e8f0',
    action: '#6366f1',
    onAction: '#ffffff',
    background: '#0e1014',
    onBackground: '#cbd5e1',
    conversationListBackground: '#0a0b0e',
    onConversationListBackground: '#e2e8f0',
    error: '#e11d48',
    onError: '#ffffff',
    notify: '#818cf8',
    onNotify: '#0a0b0e',
    onSecondaryAction: '#818cf8',
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
      // zE queues until ready; apply theme then show launcher.
      applyMiraStyle();
      messenger('show');
      // Re-apply shortly after init — some builds ignore the first set.
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
