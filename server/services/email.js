// Transactional email via Resend. No-ops gracefully if RESEND_API_KEY is unset
// so the rest of the app works without email configured.
import { Resend } from 'resend';

const API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.DIGEST_FROM_EMAIL || 'Mira Vue <onboarding@resend.dev>';

let client = null;
function getClient() {
  if (!API_KEY) return null;
  if (!client) client = new Resend(API_KEY);
  return client;
}

export function emailConfigured() {
  return Boolean(API_KEY);
}

export async function sendEmail({ to, subject, html }) {
  const c = getClient();
  if (!c) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const { error } = await c.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message || 'Resend error');
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}
