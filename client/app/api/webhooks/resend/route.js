import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_ALERT_EMAILS = ['sam@joinmira.ai', 'support@joinmira.ai'];
const SKIP_FROM = new Set(['noreply@joinmira.ai']);
const MAX_SMS_LEN = 320;
const SVIX_TOLERANCE_SEC = 60 * 5;

function parseEmailList(value, fallback = []) {
  const parts = String(value || '')
    .split(/[,;\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part));
  return parts.length ? [...new Set(parts)] : fallback;
}

function bareEmail(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function collectAddresses(data) {
  const bags = [data?.to, data?.cc, data?.bcc, data?.received_for];
  const out = [];
  for (const bag of bags) {
    if (!bag) continue;
    const list = Array.isArray(bag) ? bag : [bag];
    for (const item of list) {
      const email = bareEmail(item);
      if (email) out.push(email);
    }
  }
  return [...new Set(out)];
}

function shouldAlert(data) {
  const watch = parseEmailList(process.env.SMS_ALERT_TO_EMAILS, DEFAULT_ALERT_EMAILS);
  const recipients = collectAddresses(data);
  if (!recipients.some((addr) => watch.includes(addr))) return false;
  const from = bareEmail(data?.from);
  if (from && SKIP_FROM.has(from)) return false;
  return true;
}

function buildSmsBody(data) {
  const from = bareEmail(data?.from) || 'unknown';
  const subject = String(data?.subject || '(no subject)').replace(/\s+/g, ' ').trim();
  let body = `Mira mail: ${from}: ${subject}`;
  if (body.length > MAX_SMS_LEN) body = `${body.slice(0, MAX_SMS_LEN - 1)}…`;
  return body;
}

function decodeSvixSecret(secret) {
  const raw = String(secret || '').trim();
  if (!raw) return null;
  const b64 = raw.startsWith('whsec_') ? raw.slice('whsec_'.length) : raw;
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}

function verifySvixSignature(rawBody, headers, secret) {
  const key = decodeSvixSecret(secret);
  if (!key) return { ok: false, reason: 'missing webhook secret' };

  const svixId = headers.get('svix-id') || headers.get('Svix-Id');
  const svixTimestamp = headers.get('svix-timestamp') || headers.get('Svix-Timestamp');
  const svixSignature = headers.get('svix-signature') || headers.get('Svix-Signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: 'missing svix headers' };
  }

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' };
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > SVIX_TOLERANCE_SEC) return { ok: false, reason: 'timestamp outside tolerance' };

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(signedContent, 'utf8').digest('base64');

  const candidates = String(svixSignature)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(',');
      return idx >= 0 ? part.slice(idx + 1) : part;
    })
    .filter(Boolean);

  const expectedBuf = Buffer.from(expected);
  for (const candidate of candidates) {
    const got = Buffer.from(candidate);
    if (got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'invalid signature' };
}

async function sendTwilioSms(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.SMS_ALERT_PHONE;
  if (!sid || !token || !from || !to) {
    return { sent: false, reason: 'twilio env missing' };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('[resend-webhook] Twilio error', res.status, text.slice(0, 400));
    return { sent: false, reason: `twilio ${res.status}` };
  }
  return { sent: true };
}

export async function POST(request) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const verified = verifySvixSignature(rawBody, request.headers, secret);
  if (!verified.ok) {
    console.warn('[resend-webhook] verify failed:', verified.reason);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event?.type !== 'email.received') {
    return Response.json({ ok: true, ignored: true, type: event?.type || null });
  }

  const data = event.data || {};
  if (!shouldAlert(data)) {
    return Response.json({ ok: true, skipped: true });
  }

  const sms = buildSmsBody(data);
  try {
    const result = await sendTwilioSms(sms);
    if (!result.sent) {
      console.warn('[resend-webhook] SMS not sent:', result.reason, sms);
      // 200 so Resend does not retry forever when Twilio is not configured.
      return Response.json({ ok: true, sms: false, reason: result.reason });
    }
    return Response.json({ ok: true, sms: true });
  } catch (err) {
    console.error('[resend-webhook] SMS exception', err);
    return Response.json({ ok: true, sms: false, reason: 'exception' });
  }
}
