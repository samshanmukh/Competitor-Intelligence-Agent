'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui';

const KEY = process.env.NEXT_PUBLIC_ZENDESK_KEY || '';
const SCRIPT_ID = 'ze-snippet';
const HIDE_STYLE_ID = 'mira-zendesk-hide-default-launcher';

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

function hideDefaultLauncher() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(HIDE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIDE_STYLE_ID;
  // Hide Zendesk’s built-in square launcher; we render a round Mira FAB instead.
  style.textContent = `
    iframe#launcher,
    iframe[title="Button to launch messaging window"],
    iframe[title="Button to open the messaging window"],
    iframe[title*="launch messaging" i],
    iframe[title*="messaging window" i][title*="Button" i] {
      display: none !important;
      pointer-events: none !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

function applyMiraStyle() {
  zECall('messenger:set', 'customization', MIRA_THEME);
  zECall('messenger:set', 'zIndex', 40);
  hideDefaultLauncher();
}

/**
 * Zendesk Messaging with a round Mira launcher (default Zendesk launcher is square).
 */
export default function ZendeskWidget() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!KEY) return undefined;

    hideDefaultLauncher();

    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    const onUnread = (count) => setUnread(typeof count === 'number' ? count : 0);

    const wireEvents = () => {
      zECall('messenger:on', 'open', onOpen);
      zECall('messenger:on', 'close', onClose);
      zECall('messenger:on', 'unreadMessages', onUnread);
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      applyMiraStyle();
      wireEvents();
      return undefined;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${encodeURIComponent(KEY)}`;
    script.onload = () => {
      applyMiraStyle();
      wireEvents();
      window.setTimeout(applyMiraStyle, 400);
    };
    document.body.appendChild(script);

    return undefined;
  }, []);

  if (!KEY) return null;

  const toggle = () => {
    if (open) messenger('close');
    else messenger('open');
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : unread > 0 ? `Open chat, ${unread} unread` : 'Open chat'}
        title="Chat with Mira"
        className="pointer-events-auto relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,0.75)] transition duration-200 hover:bg-accent-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
      >
        <Icon name={open ? 'x' : 'mail'} className="h-5 w-5" />
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}

export function isZendeskEnabled() {
  return Boolean(KEY);
}
