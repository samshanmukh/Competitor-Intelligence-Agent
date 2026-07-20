// Public feature-request board: list (sorted by votes) + create.
import { NextResponse } from 'next/server';
import { attachVisitorCookie, db, visitorIdentity } from '../../../lib/serverInsforge';

const PRIORITIES = ['low', 'medium', 'high'];

function jsonError(err, fallback, status = 500) {
  const message = err?.message || fallback;
  const code = /FEATURE_REQUEST_SIGNING_SECRET|not configured/i.test(message) ? 503 : status;
  return NextResponse.json({ error: message }, { status: code });
}

export async function GET(request) {
  try {
    const insforge = db();
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (body, init) => attachVisitorCookie(NextResponse.json(body, init), identity);

    const [{ data: requests, error: reqErr }, { data: votes, error: voteErr }] = await Promise.all([
      insforge.database.from('feature_requests').select(),
      insforge.database.from('feature_votes').select('request_id, voter_ip'),
    ]);
    if (reqErr) return respond({ error: reqErr.message }, { status: 500 });
    if (voteErr) return respond({ error: voteErr.message }, { status: 500 });

    const counts = {};
    const mine = new Set();
    for (const v of votes || []) {
      counts[v.request_id] = (counts[v.request_id] || 0) + 1;
      if (v.voter_ip === me) mine.add(v.request_id);
    }

    const list = (requests || [])
      .map(({ creator_ip, ...r }) => ({ ...r, votes: counts[r.id] || 0, voted: mine.has(r.id), mine: creator_ip === me }))
      .sort((a, b) => b.votes - a.votes || new Date(b.created_at) - new Date(a.created_at));

    return respond({ requests: list });
  } catch (err) {
    return jsonError(err, 'Could not load requests.');
  }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const title = String(body?.title || '').trim().slice(0, 300);
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : 'medium';
  if (title.length < 3) {
    return NextResponse.json({ error: 'Please describe your request (at least 3 characters).' }, { status: 400 });
  }

  try {
    const insforge = db();
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);

    const { data, error } = await insforge.database
      .from('feature_requests')
      .insert({ title, priority, creator_ip: me })
      .select()
      .maybeSingle();
    if (error) return respond({ error: error.message }, { status: 500 });
    if (!data) return respond({ error: 'Could not submit request.' }, { status: 500 });
    const { creator_ip, ...clean } = data;
    return respond({ ok: true, request: { ...clean, votes: 0, voted: false, mine: true } });
  } catch (err) {
    return jsonError(err, 'Could not submit request.');
  }
}

// Edit a request — only the signed visitor that created it may edit.
export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const id = Number(body?.id);
  const title = String(body?.title || '').trim().slice(0, 300);
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : 'medium';
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  if (title.length < 3) return NextResponse.json({ error: 'Please describe your request (at least 3 characters).' }, { status: 400 });

  try {
    const insforge = db();
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);

    const { data: existing } = await insforge.database
      .from('feature_requests').select('creator_ip').eq('id', id).maybeSingle();
    if (!existing) return respond({ error: 'Not found.' }, { status: 404 });
    if (existing.creator_ip !== me) return respond({ error: 'You can only edit your own request.' }, { status: 403 });

    const { error } = await insforge.database.from('feature_requests').update({ title, priority }).eq('id', id);
    if (error) return respond({ error: error.message }, { status: 500 });
    return respond({ ok: true });
  } catch (err) {
    return jsonError(err, 'Could not update.');
  }
}

// Delete a request — only its signed creator may delete.
export async function DELETE(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    const insforge = db();
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);

    const { data: existing } = await insforge.database
      .from('feature_requests').select('creator_ip').eq('id', id).maybeSingle();
    if (!existing) return respond({ ok: true });
    if (existing.creator_ip !== me) return respond({ error: 'You can only delete your own request.' }, { status: 403 });

    await insforge.database.from('feature_requests').delete().eq('id', id);
    return respond({ ok: true });
  } catch (err) {
    return jsonError(err, 'Could not delete.');
  }
}
