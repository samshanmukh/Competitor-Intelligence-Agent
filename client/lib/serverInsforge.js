// Server-side Insforge client + IP hashing for the public feature-request board.
// Runs in Next.js route handlers (Node runtime) so it works on Vercel with no
// Express backend.
import { createClient } from '@insforge/sdk';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';

const VISITOR_COOKIE = 'mira_feature_visitor';

function getInsforgeConfig() {
  const baseUrl = process.env.INSFORGE_BASE_URL;
  const anonKey = process.env.INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error('Insforge is not configured. Set INSFORGE_BASE_URL and INSFORGE_ANON_KEY.');
  }
  return { baseUrl, anonKey };
}

export function db() {
  return createClient(getInsforgeConfig());
}

function getSigningSecret() {
  const secret = process.env.FEATURE_REQUEST_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Set FEATURE_REQUEST_SIGNING_SECRET to at least 32 characters.');
  }
  return secret;
}

function signVisitor(id) {
  return createHmac('sha256', getSigningSecret()).update(id).digest('hex');
}

function validSignature(id, signature) {
  if (!id || !signature) return false;
  const expected = Buffer.from(signVisitor(id), 'hex');
  const provided = Buffer.from(signature, 'hex');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

// Public feature requests use a signed, HTTP-only visitor cookie. This avoids
// trusting spoofable forwarding headers while keeping the board usable without
// requiring an account.
export function visitorIdentity(request) {
  const raw = request.cookies.get(VISITOR_COOKIE)?.value || '';
  const [storedId, storedSignature] = raw.split('.');
  const id = validSignature(storedId, storedSignature) ? storedId : randomUUID();
  const cookieValue = `${id}.${signVisitor(id)}`;
  const key = createHash('sha256').update(`${id}|mira-feature-votes`).digest('hex');
  return { key, cookieValue, isNew: raw !== cookieValue };
}

export function attachVisitorCookie(response, identity) {
  if (identity?.isNew) {
    response.cookies.set(VISITOR_COOKIE, identity.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
