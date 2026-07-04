// Toggle a vote for a feature request — one vote per IP per request.
import { NextResponse } from 'next/server';
import { db, voterKey } from '../../../../lib/serverInsforge';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const requestId = Number(body?.requestId);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
  }

  const insforge = db();
  const me = voterKey(request);
  try {
    const { data: existing } = await insforge.database
      .from('feature_votes')
      .select('id')
      .eq('request_id', requestId)
      .eq('voter_ip', me)
      .maybeSingle();

    if (existing) {
      await insforge.database.from('feature_votes').delete().eq('id', existing.id);
      return NextResponse.json({ ok: true, voted: false });
    }

    const { error } = await insforge.database
      .from('feature_votes')
      .insert({ request_id: requestId, voter_ip: me });
    // Unique violation (double-click race) is still a success — the vote exists.
    if (error && !/duplicate|unique/i.test(error.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, voted: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not vote.' }, { status: 500 });
  }
}
