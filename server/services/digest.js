// Weekly digest email: per workspace, summarize the last 7 days of competitor
// changes and email it via Resend.
import { listDigestWorkspaces } from '../db/workspace.js';
import { listRecentChanges } from '../db/index.js';
import { sendEmail, emailConfigured } from './email.js';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function impactColor(impact) {
  return impact === 'high' ? '#f87171' : impact === 'medium' ? '#fbbf24' : '#94a3b8';
}

function parseAnalysis(c) {
  try { return typeof c.analysis === 'string' ? JSON.parse(c.analysis) : c.analysis; } catch { return null; }
}

function buildDigestHtml(workspace, changes) {
  const rows = changes.slice(0, 15).map((c) => {
    const a = parseAnalysis(c) || {};
    const impact = a.impact || 'low';
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1f2430;">
          <div style="font-weight:600;color:#e5e7eb;font-size:14px;">${c.competitor_name || 'Competitor'}
            <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9px;font-size:11px;color:${impactColor(impact)};border:1px solid ${impactColor(impact)}40;">${impact} impact</span>
          </div>
          <div style="color:#9ca3af;font-size:13px;margin-top:3px;">${(a.summary || c.summary || 'Pricing page updated').replace(/</g, '&lt;')}</div>
        </td>
      </tr>`;
  }).join('');

  return `<!doctype html><html><body style="margin:0;background:#0a0b0e;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="color:#fff;font-size:18px;font-weight:700;">Your weekly competitor digest</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:4px;">${workspace.name} · ${changes.length} change${changes.length !== 1 ? 's' : ''} in the last 7 days</div>
      ${changes.length === 0
        ? `<div style="margin-top:24px;color:#9ca3af;font-size:14px;">No competitor changes detected this week. We'll keep watching.</div>`
        : `<table style="width:100%;border-collapse:collapse;margin-top:20px;">${rows}</table>`}
      <a href="${APP_URL}/app" style="display:inline-block;margin-top:24px;padding:10px 18px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open the dashboard</a>
      <div style="color:#4b5563;font-size:11px;margin-top:28px;">You're receiving this because weekly digests are enabled for ${workspace.name}. Turn it off in Settings → Notifications.</div>
    </div>
  </body></html>`;
}

export async function sendWeeklyDigests() {
  if (!emailConfigured()) {
    console.warn('[digest] RESEND_API_KEY not set — weekly digests skipped.');
    return { sent: 0, skipped: 'not_configured' };
  }
  const workspaces = await listDigestWorkspaces();
  const weekAgo = Date.now() - 7 * 86400 * 1000;
  let sent = 0;

  for (const ws of workspaces) {
    try {
      const all = await listRecentChanges(200, ws.id);
      const recent = all.filter((c) => new Date(c.detected_at).getTime() >= weekAgo);
      const html = buildDigestHtml(ws, recent);
      const res = await sendEmail({
        to: ws.digest_email,
        subject: `Mira Vue — weekly competitor digest — ${recent.length} change${recent.length !== 1 ? 's' : ''}`,
        html,
      });
      if (res.sent) sent++;
    } catch (err) {
      console.error(`[digest] failed for workspace ${ws.id}:`, err.message);
    }
  }
  console.log(`[digest] sent ${sent}/${workspaces.length} weekly digests`);
  return { sent };
}
