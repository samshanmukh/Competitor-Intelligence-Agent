// Weekly digest email: per workspace, summarize the last 7 days of competitor
// changes and email it via Resend.
import { listDigestWorkspaces } from '../db/workspace.js';
import { listRecentChanges, getSetting } from '../db/index.js';
import { sendEmail, emailConfigured } from './email.js';
import { distributionSnapshotKey, diffDistribution, getSignificantShifts } from './marketDistribution.js';
import { getWorkspaceJson } from './workspaceStore.js';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function impactColor(impact) {
  return impact === 'high' ? '#f87171' : impact === 'medium' ? '#fbbf24' : '#94a3b8';
}

function parseAnalysis(c) {
  try { return typeof c.analysis === 'string' ? JSON.parse(c.analysis) : c.analysis; } catch { return null; }
}

function formatPulseSection(distribution, pulse = null, syndicated = null) {
  if (!distribution?.items?.length) return '';
  const top = distribution.items.slice(0, 4);
  const rows = top
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #1f2430;color:#e5e7eb;font-size:13px;">${i.name}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #1f2430;color:#9ca3af;font-size:13px;text-align:right;">${i.presence_pct ?? i.share_pct ?? '—'}% presence</td></tr>`
    )
    .join('');

  const significant = pulse ? getSignificantShifts(pulse) : [];
  const shiftBlock = significant.length
    ? `<div style="margin-top:12px;padding:10px 12px;border-radius:8px;border:1px solid #f59e0b40;background:#f59e0b10;color:#fcd34d;font-size:12px;">
        <b>Notable shifts:</b> ${significant.slice(0, 3).map((s) => `${s.name} ${s.delta_pct > 0 ? '+' : ''}${s.delta_pct}pp`).join(' · ')}
      </div>`
    : '';

  const synRow = syndicated?.table?.rows?.find((r) => r.published_share_pct != null);
  const synBlock = synRow
    ? `<div style="margin-top:10px;color:#a5b4fc;font-size:12px;">Published: ${synRow.name} ${synRow.published_share_pct}% (${synRow.publisher || 'analyst source'})</div>`
    : '';

  return `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1f2430;">
      <div style="color:#fff;font-size:15px;font-weight:600;">Market pulse</div>
      <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Estimated competitor presence (${distribution.method || 'snapshot'})</div>
      ${shiftBlock}
      ${synBlock}
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>
      <div style="color:#6b7280;font-size:11px;margin-top:8px;">Directional estimates — view full distribution on Mira AI.</div>
    </div>`;
}

async function loadDistributionPulse(workspaceId) {
  try {
    const raw = await getSetting(distributionSnapshotKey(workspaceId));
    const current = raw ? JSON.parse(raw) : null;
    if (!current?.items?.length) return { distribution: null, pulse: null, syndicated: null };
    const prevRaw = await getSetting(`${distributionSnapshotKey(workspaceId)}:prev`);
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    const pulse = prev?.items?.length ? diffDistribution(prev, current) : null;
    return { distribution: current, pulse, syndicated: current.syndicated ?? null };
  } catch {
    return { distribution: null, pulse: null, syndicated: null };
  }
}

function formatActionsSection(moves = [], topN = 3) {
  if (!moves?.length) return '';
  const rows = moves
    .slice(0, topN)
    .map(
      (m, i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #1f2430;color:#e5e7eb;font-size:13px;">${i + 1}. ${m.title || 'Action'}</td>
         <td style="padding:8px 0;border-bottom:1px solid #1f2430;color:#9ca3af;font-size:12px;text-align:right;">${m.impact || ''} · ${m.effort || ''}</td></tr>`
    )
    .join('');
  return `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1f2430;">
      <div style="color:#fff;font-size:15px;font-weight:600;">Top moves this week</div>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>
      <a href="${APP_URL}/moves" style="display:inline-block;margin-top:12px;color:#a5b4fc;font-size:12px;">Open next-moves brief →</a>
    </div>`;
}

function buildDigestHtml(workspace, changes, pulseSection = '', actionsSection = '') {
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
      ${actionsSection}
      ${changes.length === 0
        ? `<div style="margin-top:24px;color:#9ca3af;font-size:14px;">No competitor changes detected this week. We'll keep watching.</div>`
        : `<table style="width:100%;border-collapse:collapse;margin-top:20px;">${rows}</table>`}
      ${pulseSection}
      <a href="${APP_URL}/distribution" style="display:inline-block;margin-top:24px;padding:10px 18px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View distribution</a>
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
      const prefs = (await getWorkspaceJson(ws.id, 'digest-prefs', {
        onlySignificant: true,
        topActions: 3,
        includeDistribution: true,
      })) || {};

      const all = await listRecentChanges(200, ws.id);
      let recent = all.filter((c) => new Date(c.detected_at).getTime() >= weekAgo);
      if (prefs.onlySignificant) {
        const significant = recent.filter((c) => {
          const a = parseAnalysis(c);
          return a?.impact === 'high' || a?.impact === 'medium';
        });
        if (significant.length) recent = significant;
      }

      const { distribution, pulse, syndicated } = await loadDistributionPulse(ws.id);
      const pulseSection = prefs.includeDistribution === false ? '' : formatPulseSection(distribution, pulse, syndicated);

      const nextMoves = await getWorkspaceJson(ws.id, 'next-moves-latest', null);
      const actionsSection = formatActionsSection(nextMoves?.moves || [], prefs.topActions || 3);

      const html = buildDigestHtml(ws, recent, pulseSection, actionsSection);
      const res = await sendEmail({
        to: ws.digest_email,
        subject: `Mira AI — weekly competitor digest — ${recent.length} change${recent.length !== 1 ? 's' : ''}`,
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
