// Toggle a vote for a feature request, one vote per signed visitor.
import { NextResponse } from 'next/server';
import { attachVisitorCookie, db, visitorIdentity } from '../../../../lib/serverInsforge';

function jsonError(err, fallback) {
  const message = err?.message || fallback;
  const status = /FEATURE_REQUEST_SIGNING_SECRET|not configured/i.test(message) ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const requestId = Number(body?.requestId);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  }

  try {
    const insforge = db();
    const identity = visitorIdentity(request);
    const me = identity.key;
    const respond = (responseBody, init) => attachVisitorCookie(NextResponse.json(responseBody, init), identity);

    const { data: existing } = await insforge.database
      .from('feature_votes')
      .select('id')
      .eq('request_id', requestId)
      .eq('voter_ip', me)
      .maybeSingle();

    if (existing) {
      await insforge.database.from('feature_votes').delete().eq('id', existing.id);
      return respond({ ok: true, voted: false });
    }

    const { error } = await insforge.database
      .from('feature_votes')
      .insert({ request_id: requestId, voter_ip: me });
    // Unique violation (double-click race) is still a success, the vote exists.
    if (error && !/duplicate|unique/i.test(error.message || '')) {
      return respond({ error: error.message }, { status: 500 });
    }
    return respond({ ok: true, voted: true });
  } catch (err) {
    return jsonError(err, 'Could not vote.');
  }
}
