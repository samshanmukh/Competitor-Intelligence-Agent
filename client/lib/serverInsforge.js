// Server-side Insforge client + IP hashing for the public feature-request board.
// Runs in Next.js route handlers (Node runtime) so it works on Vercel with no
// Express backend.
import { createClient } from '@insforge/sdk';
import { createHash } from 'crypto';

const INSFORGE_URL = process.env.INSFORGE_BASE_URL || 'https://tpq6mvqe.us-east.insforge.app';
const INSFORGE_ANON =
  process.env.INSFORGE_ANON_KEY ||
  'anon_b6023a1adec5472cfe335ee7fec1139a85bd05a43a2f0513e2eba963c4a71d1f';

export function db() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON });
}

// Derive a stable, non-reversible per-visitor key from the request IP so we can
// enforce one vote per IP without storing raw addresses.
export function voterKey(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${ip}|mira-feature-votes`).digest('hex');
}
