// Optional outbound webhook for change alerts (Slack / Discord / generic).
// Slack and Discord both accept a JSON body with a top-level "text"/"content"
// field, so we send a payload that works for either.

import { getSetting } from '../db/index.js';

export async function sendWebhook(change, competitor) {
  const url = await getSetting('webhook_url');
  if (!url) return { sent: false, reason: 'no webhook configured' };

  let analysis = {};
  try {
    analysis = change.analysis ? JSON.parse(change.analysis) : {};
  } catch {
    /* ignore */
  }

  const headline = analysis.summary || change.summary || 'Pricing change detected';
  const text = `:moneybag: *Pricing change — ${competitor.name}*\n${headline}\n${competitor.pricing_url}`;

  // Slack uses { text }, Discord uses { content }. Include both for compatibility.
  const body = { text, content: text };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}
