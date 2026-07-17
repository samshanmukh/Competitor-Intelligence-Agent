// Public feature-request board: list (sorted by votes) + create.
import { NextResponse } from 'next/server';
import { attachVisitorCookie, db, visitorIdentity } from '../../../lib/serverInsforge';

const PRIORITIES = ['low', 'medium', 'high'];

export async function GET(request) {
  const insforge = db();
  const identity = visitorIdentity(request);
  const me = identity.key;
  const respond = (body, init) => attachVisitorCookie(NextResponse.json(body, init), identity);
  try {
    const [{ data: requests }, { data: votes }] = await Promise.all([
      insforge.database.from('feature_requests').select(),
      insforge.database.from('feature_votes').select('request_id, voter_ip'),
    ]);

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
    return respond({ error: err.message || 'Could not load requests.' }, { status: 500 });
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

  const insforge = db();
  const identity = visitorIdentity(request);
  const me = identity.key;
  const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
  try {
    const { data, error } = await insforge.database
      .from('feature_requests')
      .insert({ title, priority, creator_ip: me })
      .select()
      .maybeSingle();
    if (error) return respond({ error: error.message }, { status: 500 });
    const { creator_ip, ...clean } = data;
    return respond({ ok: true, request: { ...clean, votes: 0, voted: false, mine: true } });
  } catch (err) {
    return respond({ error: err.message || 'Could not submit request.' }, { status: 500 });
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

  const insforge = db();
  const identity = visitorIdentity(request);
  const me = identity.key;
  const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
  try {
    const { data: existing } = await insforge.database
      .from('feature_requests').select('creator_ip').eq('id', id).maybeSingle();
    if (!existing) return respond({ error: 'Not found.' }, { status: 404 });
    if (existing.creator_ip !== me) return respond({ error: 'You can only edit your own request.' }, { status: 403 });

    const { error } = await insforge.database.from('feature_requests').update({ title, priority }).eq('id', id);
    if (error) return respond({ error: error.message }, { status: 500 });
    return respond({ ok: true });
  } catch (err) {
    return respond({ error: err.message || 'Could not update.' }, { status: 500 });
  }
}

// Delete a request — only its signed creator may delete.
export async function DELETE(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const insforge = db();
  const identity = visitorIdentity(request);
  const me = identity.key;
  const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
  try {
    const { data: existing } = await insforge.database
      .from('feature_requests').select('creator_ip').eq('id', id).maybeSingle();
    if (!existing) return respond({ ok: true });
    if (existing.creator_ip !== me) return respond({ error: 'You can only delete your own request.' }, { status: 403 });

    await insforge.database.from('feature_requests').delete().eq('id', id);
    return respond({ ok: true });
  } catch (err) {
    return respond({ error: err.message || 'Could not delete.' }, { status: 500 });
  }
}
