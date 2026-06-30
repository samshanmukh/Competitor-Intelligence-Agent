// Public waitlist signup — runs as a serverless function (works on Vercel with
// NO Express backend). Writes straight to the Insforge `waitlist` table.
import { NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_URL = process.env.INSFORGE_BASE_URL || 'https://tpq6mvqe.us-east.insforge.app';
const INSFORGE_ANON =
  process.env.INSFORGE_ANON_KEY ||
  'anon_b6023a1adec5472cfe335ee7fec1139a85bd05a43a2f0513e2eba963c4a71d1f';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.', code: 'INVALID_EMAIL' },
      { status: 400 }
    );
  }

  const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON });

  try {
    // Idempotent: a repeat email is treated as success.
    const { data: existing } = await insforge.database
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, already: true });

    const { error } = await insforge.database
      .from('waitlist')
      .insert({
        email,
        source: body?.source || 'landing',
        referrer: request.headers.get('referer') || null,
      });
    if (error) {
      if (/duplicate|unique/i.test(error.message || '')) return NextResponse.json({ ok: true, already: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, already: false });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not join the waitlist.' }, { status: 500 });
  }
}
