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
} from '../db/workspace.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Current user + workspaces
router.get('/me', requireAuth, wrap(async (req, res) => {
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
    subject: 'Test — Mira Intelligence weekly digest',
    html: `<div style="font-family:sans-serif;padding:24px;"><h2>It works ✅</h2><p>Weekly digests will arrive here every Sunday with the past week's competitor changes.</p></div>`,
  });
  res.json(result);
}));

// Get workspace members
router.get('/workspaces/:id/members', requireAuth, wrap(async (req, res) => {
  const members = await getWorkspaceMembers(req.params.id);
  res.json({ members });
}));

// Add member (invite)
router.post('/workspaces/:id/members', requireAuth, wrap(async (req, res) => {
  const { email, role = 'analyst' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  // In a full impl, this would send an invite email.
  // For now, add by email as an "invited" member.
  const member = await addWorkspaceMember(req.params.id, `invited:${email}`, role, email);
  res.json({ member });
}));

// Remove member
router.delete('/workspaces/:id/members/:userId', requireAuth, wrap(async (req, res) => {
  await removeWorkspaceMember(req.params.id, req.params.userId);
  res.json({ ok: true });
}));

// Ensure workspace exists (called on first login)
router.post('/ensure-workspace', requireAuth, wrap(async (req, res) => {
  const ws = await ensureUserHasWorkspace(req.user.id, req.user.email);
  res.json({ workspace: ws });
}));

export default router;
