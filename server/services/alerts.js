// Optional outbound webhook for change alerts (Slack / Discord / generic).

import { getSetting } from '../db/index.js';

function isSlackUrl(url) {
  return /hooks\.slack\.com/i.test(url || '');
}

function slackBlocks({ title, lines = [], url = null, footer = 'Mira Vue' }) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title.slice(0, 150), emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: lines.filter(Boolean).join('\n').slice(0, 2900) || '_No details_' },
    },
  ];
  if (url) {
    blocks.push({
      type: 'actions',
      elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in Mira Vue' }, url }],
    });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: footer }],
  });
  return blocks;
}

async function postWebhook(url, { text, title, lines, link }) {
  const body = isSlackUrl(url)
    ? { text, blocks: slackBlocks({ title, lines, url: link }) }
    : { text, content: text };

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
  const impact = analysis.impact || 'unknown';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/competitors/${competitor.id}`;
  const text = `Pricing change — ${competitor.name}\n${headline}\nImpact: ${impact}\n${competitor.pricing_url}`;

  return postWebhook(url, {
    text,
    title: `Pricing change — ${competitor.name}`,
    lines: [`*Impact:* ${impact}`, headline, `<${competitor.pricing_url}|Pricing page>`],
    link,
  });
}

/** Slack/Discord webhook for significant market presence shifts (Phase 4). */
export async function sendMarketShiftWebhook(workspaceId, shifts, method = 'snapshot') {
  const url = await getSetting('webhook_url');
  if (!url || !shifts?.length) return { sent: false, reason: 'no webhook or shifts' };

  const lines = shifts
    .slice(0, 4)
    .map((s) => `• *${s.name}*: ${s.prev_pct}% → ${s.next_pct}% (${s.delta_pct > 0 ? '+' : ''}${s.delta_pct}pp)`);
  const text = `Market presence shift (${method})\n${lines.join('\n')}`;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  return postWebhook(url, {
    text,
    title: 'Market presence shift',
    lines: [`_Method: ${method}_`, ...lines],
    link: `${appUrl}/distribution`,
  });
}
