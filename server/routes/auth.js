import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import {
  getUserWorkspaces,
  createWorkspace,
  getWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspace,
  ensureUserHasWorkspace,
  claimPendingInvites,
  findPendingInvite,
  isWorkspaceMember,
} from '../db/workspace.js';
import { sendEmail, emailConfigured } from '../services/email.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Current user + workspaces
router.get('/me', requireAuth, wrap(async (req, res) => {
  // Claim any pending email invites when the user hits /me.
  if (req.user?.email) {
    await claimPendingInvites(req.user.id, req.user.email).catch(() => {});
  }
  const workspaces = await getUserWorkspaces(req.user.id);
  res.json({ user: req.user, workspaces });
}));

// List user's workspaces
router.get('/workspaces', requireAuth, wrap(async (req, res) => {
  const workspaces = await getUserWorkspaces(req.user.id);
  res.json({ workspaces });
}));

// Create workspace
router.post('/workspaces', requireAuth, wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Workspace name is required' });
  const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
  const ws = await createWorkspace({ name: name.trim(), slug, ownerId: req.user.id });
  res.json({ workspace: ws });
}));

// Get workspace detail
router.get('/workspaces/:id', requireAuth, wrap(async (req, res) => {
  const ws = await getWorkspace(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  res.json({ workspace: ws });
}));

// Update workspace (name and/or weekly-digest settings)
router.patch('/workspaces/:id', requireAuth, wrap(async (req, res) => {
  const { name, digest_enabled, digest_email } = req.body || {};
  const updates = {};
  if (name) updates.name = name.trim();
  if (digest_enabled !== undefined) updates.digest_enabled = Boolean(digest_enabled);
  if (digest_email !== undefined) updates.digest_email = (digest_email || '').trim() || null;
  const ws = await updateWorkspace(req.params.id, updates);
  res.json({ workspace: ws });
}));

// Send a test digest immediately (to verify email setup).
router.post('/workspaces/:id/digest-test', requireAuth, wrap(async (req, res) => {
  const { getWorkspace: getWs } = await import('../db/workspace.js');
  const { sendEmail, emailConfigured } = await import('../services/email.js');
  if (!emailConfigured()) {
    return res.status(400).json({ error: 'Email is not configured (set RESEND_API_KEY on the server).', code: 'EMAIL_NOT_CONFIGURED' });
  }
  const ws = await getWs(req.params.id);
  const to = req.body?.email || ws?.digest_email;
  if (!to) return res.status(400).json({ error: 'No digest email set' });
  const result = await sendEmail({
    to,
    subject: 'Test — Mira Vue weekly digest',
    html: `<div style="font-family:sans-serif;padding:24px;"><h2>It works ✅</h2><p>Weekly digests will arrive here every Sunday with the past week's competitor changes.</p></div>`,
  });
  res.json(result);
}));

// Get workspace members
router.get('/workspaces/:id/members', requireAuth, wrap(async (req, res) => {
  const members = await getWorkspaceMembers(req.params.id);
  res.json({ members });
}));

// Add member (invite) — stores pending row and emails a join link when Resend is configured.
router.post('/workspaces/:id/members', requireAuth, wrap(async (req, res) => {
  const { email, role = 'analyst' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const normalized = email.trim().toLowerCase();
  const ws = await getWorkspace(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });

  // Already a real member?
  const members = await getWorkspaceMembers(req.params.id);
  const existingPending = members.find((m) => m.user_id === `invited:${normalized}` || m.invited_email?.toLowerCase() === normalized);
  if (existingPending) return res.json({ member: existingPending, already: true });

  const member = await addWorkspaceMember(req.params.id, `invited:${normalized}`, role, normalized);

  const inviteUrl = `${APP_URL}/invite/${req.params.id}?email=${encodeURIComponent(normalized)}`;
  let emailed = false;
  if (emailConfigured()) {
    const result = await sendEmail({
      to: normalized,
      subject: `You're invited to ${ws.name} on Mira Vue`,
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;">
        <h2 style="margin:0 0 12px;">Join ${ws.name}</h2>
        <p style="color:#475569;line-height:1.5;">${req.user?.email || 'A teammate'} invited you to collaborate on Mira Vue as <strong>${role}</strong>.</p>
        <p style="margin:24px 0;"><a href="${inviteUrl}" style="background:#3b82f6;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invite</a></p>
        <p style="color:#94a3b8;font-size:12px;">Or sign up / sign in with <strong>${normalized}</strong> and open this link.</p>
      </div>`,
    });
    emailed = Boolean(result?.sent);
  }

  res.json({ member, emailed, inviteUrl });
}));

// Public-ish invite metadata (auth optional — used on invite landing page).
router.get('/invite-info/:workspaceId', wrap(async (req, res) => {
  const ws = await getWorkspace(req.params.workspaceId);
  if (!ws) return res.status(404).json({ error: 'Invite not found' });
  res.json({ workspace: { id: ws.id, name: ws.name } });
}));

// Accept invite for the logged-in user (must match invited email).
router.post('/accept-invite', requireAuth, wrap(async (req, res) => {
  const workspaceId = req.body?.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
  const email = (req.user?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'Your account has no email' });

  if (await isWorkspaceMember(req.user.id, workspaceId)) {
    const ws = await getWorkspace(workspaceId);
    return res.json({ workspace: ws, already: true });
  }

  const pending = await findPendingInvite(workspaceId, email);
  if (!pending) {
    return res.status(404).json({ error: 'No pending invite for this email on that workspace' });
  }

  await removeWorkspaceMember(workspaceId, pending.user_id);
  await addWorkspaceMember(workspaceId, req.user.id, pending.role || 'analyst', null);
  const ws = await getWorkspace(workspaceId);
  res.json({ workspace: ws });
}));

// Remove member
router.delete('/workspaces/:id/members/:userId', requireAuth, wrap(async (req, res) => {
  await removeWorkspaceMember(req.params.id, req.params.userId);
  res.json({ ok: true });
}));

// Ensure workspace exists (called on first login)
router.post('/ensure-workspace', requireAuth, wrap(async (req, res) => {
  if (req.user?.email) {
    await claimPendingInvites(req.user.id, req.user.email).catch(() => {});
  }
  const ws = await ensureUserHasWorkspace(req.user.id, req.user.email);
  res.json({ workspace: ws });
}));

export default router;
