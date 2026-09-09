// Toggle a vote for a feature request, one vote per browser visitor.
import { NextResponse } from 'next/server';
import {
  attachVisitorCookie,
  updateFeatureRequestStore,
  visitorIdentity,
} from '../../../../lib/featureRequestStore';

function jsonError(err, fallback) {
  return NextResponse.json({ error: err?.message || fallback }, { status: 500 });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const requestId = Number(body?.requestId);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  }

  try {
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);
    const result = await updateFeatureRequestStore((store) => {
      if (!store.requests.some((row) => row.id === requestId)) return 'missing';
      const index = store.votes.findIndex((vote) => vote.requestId === requestId && vote.voterKey === me);
      if (index !== -1) {
        store.votes.splice(index, 1);
        return 'removed';
      }
      store.votes.push({ id: store.nextVoteId++, requestId, voterKey: me });
      return 'added';
    });
    if (result === 'missing') return respond({ error: 'Feature request not found.' }, { status: 404 });
    return respond({ ok: true, voted: result === 'added' });
  } catch (err) {
    return jsonError(err, 'Could not vote.');
  }
}
