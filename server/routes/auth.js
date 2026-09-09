import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAllWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  getDefaultWorkspace,
} from '../db/workspace.js';
import { resolveEntitlements } from '../services/entitlements.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function findWorkspace(req, res) {
  const ws = await getWorkspace(req.params.id);
  if (!ws) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return ws;
}

// Shared app context + workspaces + plan entitlements.
router.get('/me', requireAuth, wrap(async (req, res) => {
  const workspaces = await getAllWorkspaces();
  const headerWs = Number(req.headers['x-workspace-id']);
  const active =
    (Number.isFinite(headerWs) && workspaces.find((w) => Number(w.id) === headerWs))
    || workspaces[0]
    || null;
  const entitlements = resolveEntitlements(req.user?.email, active?.plan || 'free');
  res.json({
    user: { ...req.user, accountTier: entitlements.tier },
    workspaces,
    entitlements,
  });
}));

// List shared workspaces.
router.get('/workspaces', requireAuth, wrap(async (req, res) => {
  let workspaces = await getAllWorkspaces();
  if (workspaces.length === 0) {
    await getDefaultWorkspace();
    workspaces = await getAllWorkspaces();
  }
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
  const workspace = await findWorkspace(req, res);
  if (!workspace) return;
  res.json({ workspace });
}));

// Update workspace (name and/or weekly-digest settings)
router.patch('/workspaces/:id', requireAuth, wrap(async (req, res) => {
  const workspace = await findWorkspace(req, res);
  if (!workspace) return;
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
  const workspace = await findWorkspace(req, res);
  if (!workspace) return;
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
    subject: 'Test — Mira AI weekly digest',
    html: `<div style="font-family:sans-serif;padding:24px;"><h2>It works ✅</h2><p>Weekly digests will arrive here every Sunday with the past week's competitor changes.</p></div>`,
  });
  res.json(result);
}));

// Ensure a shared workspace exists.
router.post('/ensure-workspace', requireAuth, wrap(async (req, res) => {
  const ws = await getDefaultWorkspace();
  res.json({ workspace: ws });
}));

export default router;
