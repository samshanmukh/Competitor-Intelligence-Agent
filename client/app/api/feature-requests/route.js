// Public feature-request board: list (sorted by votes) + create.
import { NextResponse } from 'next/server';
import {
  attachVisitorCookie,
  readFeatureRequestStore,
  updateFeatureRequestStore,
  visitorIdentity,
} from '../../../lib/featureRequestStore';

const PRIORITIES = ['low', 'medium', 'high'];

function jsonError(err, fallback) {
  return NextResponse.json({ error: err?.message || fallback }, { status: 500 });
}

export async function GET(request) {
  try {
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (body, init) => attachVisitorCookie(NextResponse.json(body, init), identity);
    const { requests, votes } = await readFeatureRequestStore();

    const counts = {};
    const mine = new Set();
    for (const v of votes || []) {
      counts[v.requestId] = (counts[v.requestId] || 0) + 1;
      if (v.voterKey === me) mine.add(v.requestId);
    }

    const list = requests
      .map(({ creatorKey, ...r }) => ({ ...r, votes: counts[r.id] || 0, voted: mine.has(r.id), mine: creatorKey === me }))
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
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
    const data = await updateFeatureRequestStore((store) => {
      const now = new Date().toISOString();
      const row = {
        id: store.nextRequestId++,
        title,
        priority,
        status: 'open',
        creatorKey: me,
        created_at: now,
        updated_at: now,
      };
      store.requests.push(row);
      return row;
    });
    const { creatorKey, ...clean } = data;
    return respond({ ok: true, request: { ...clean, votes: 0, voted: false, mine: true } });
  } catch (err) {
    return jsonError(err, 'Could not submit request.');
  }
}

// Edit a request; only the browser that created it may edit.
export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const id = Number(body?.id);
  const title = String(body?.title || '').trim().slice(0, 300);
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : 'medium';
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  if (title.length < 3) return NextResponse.json({ error: 'Please describe your request (at least 3 characters).' }, { status: 400 });

  try {
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
    const result = await updateFeatureRequestStore((store) => {
      const existing = store.requests.find((row) => row.id === id);
      if (!existing) return 'missing';
      if (existing.creatorKey !== me) return 'forbidden';
      existing.title = title;
      existing.priority = priority;
      existing.updated_at = new Date().toISOString();
      return 'updated';
    });
    if (result === 'missing') return respond({ error: 'Not found.' }, { status: 404 });
    if (result === 'forbidden') return respond({ error: 'You can only edit your own request.' }, { status: 403 });
    return respond({ ok: true });
  } catch (err) {
    return jsonError(err, 'Could not update.');
  }
}

// Delete a request; only the browser that created it may delete.
export async function DELETE(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
    const result = await updateFeatureRequestStore((store) => {
      const index = store.requests.findIndex((row) => row.id === id);
      if (index === -1) return 'missing';
      if (store.requests[index].creatorKey !== me) return 'forbidden';
      store.requests.splice(index, 1);
      store.votes = store.votes.filter((vote) => vote.requestId !== id);
      return 'deleted';
    });
    if (result === 'forbidden') return respond({ error: 'You can only delete your own request.' }, { status: 403 });
    return respond({ ok: true });
  } catch (err) {
    return jsonError(err, 'Could not delete.');
  }
}
