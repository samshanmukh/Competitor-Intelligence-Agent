/**
 * Presence for Mira Band agents.
 * Roster "online" = Band process heartbeating.
 * inAppOnline = Ask Mira chat can still answer via the API (separate path).
 */

import { getKey } from './keys.js';

const ONLINE_WINDOW_MS = 45_000;

/** @type {Map<string, { at: number, meta?: object }>} */
const heartbeats = new Map();

export const ANALYST_AGENTS = [
  {
    id: 'mira',
    name: 'Mira',
    role: 'Lead analyst',
    inApp: true,
    band: true,
  },
  {
    id: 'pricing',
    name: 'Pricing',
    role: 'Tiers & value',
    inApp: true,
    band: true,
  },
  {
    id: 'watch',
    name: 'Watch',
    role: 'Changes & alerts',
    inApp: false,
    band: true,
  },
  {
    id: 'positioning',
    name: 'Positioning',
    role: 'Landscape & gaps',
    inApp: false,
    band: true,
  },
  {
    id: 'market',
    name: 'Market',
    role: 'Pulse & TAM model',
    inApp: false,
    band: true,
  },
];

export function recordHeartbeat(id, meta = {}) {
  const key = String(id || '').toLowerCase().trim();
  if (!key) return false;
  const known = ANALYST_AGENTS.some((a) => a.id === key);
  if (!known) return false;
  heartbeats.set(key, { at: Date.now(), meta });
  return true;
}

function aiReady() {
  try {
    return Boolean(getKey('XAI_API_KEY'));
  } catch {
    return false;
  }
}

export function listAgentStatus() {
  const ready = aiReady();
  const now = Date.now();

  return ANALYST_AGENTS.map((agent) => {
    const hb = heartbeats.get(agent.id);
    const bandOnline = Boolean(hb && now - hb.at < ONLINE_WINDOW_MS);
    const inAppOnline = Boolean(agent.inApp && ready);
    // Roster online means the Band.ai agent process is live.
    const online = bandOnline;

    const channels = [];
    if (agent.band) channels.push('band');
    if (agent.inApp) channels.push('in-app');

    let status = 'offline';
    if (bandOnline) status = 'online';
    else if (agent.inApp && !ready) status = 'needs_key';

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      channels,
      status,
      online,
      inAppOnline,
      bandOnline,
      lastSeen: hb?.at || null,
    };
  });
}
