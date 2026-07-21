const SUPPORT_TO = 'support@joinmira.ai';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  const subject = String(body?.subject || '').trim();
  const message = String(body?.message || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (!subject || subject.length < 3) {
    return Response.json({ error: 'Subject is required.' }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return Response.json({ error: 'Please include a bit more detail in your message.' }, { status: 400 });
  }
  if (subject.length > 200 || message.length > 5000) {
    return Response.json({ error: 'Message is too long.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Support email is not configured yet.' }, { status: 503 });
  }

  const from = process.env.DIGEST_FROM_EMAIL || 'Mira <noreply@joinmira.ai>';
  const text = [
    `From: ${email}`,
    `Subject: ${subject}`,
    '',
    message,
  ].join('\n');
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#0f172a">
      <p style="margin:0 0 8px;color:#64748b;font-size:13px">Mira support request</p>
      <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(email)}</p>
      <p style="margin:0 0 16px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <div style="white-space:pre-wrap;border-top:1px solid #e2e8f0;padding-top:16px">${escapeHtml(message)}</div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [SUPPORT_TO],
        reply_to: email,
        subject: `[Mira Support] ${subject}`,
        text,
        html,
        tags: [
          { name: 'type', value: 'support' },
        ],
      }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error || `Could not send (${res.status})`;
      return Response.json({ error: msg }, { status: 502 });
    }
    return Response.json({ ok: true, id: data.id || null });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not send support email.' }, { status: 502 });
  }
}
