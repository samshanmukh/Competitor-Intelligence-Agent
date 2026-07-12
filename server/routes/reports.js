import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import insforge, { getSetting } from '../db/index.js';
import { diffReportDistribution, distributionSnapshotKey } from '../services/marketDistribution.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// List saved reports for the workspace (metadata only).
router.get('/', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { data } = await insforge.database
    .from('reports')
    .select('id, title, token, created_by, created_at')
    .eq('workspace_id', req.workspaceId)
    .order('created_at', { ascending: false });
  res.json({ reports: data || [] });
}));

// Save a new report snapshot.
router.post('/', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { title, content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });
  const token = randomBytes(12).toString('hex');
  const { data } = await insforge.database
    .from('reports')
    .insert({
      workspace_id: req.workspaceId,
      title: (title || 'Competitive report').slice(0, 200),
      token,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      created_by: req.user.id,
    })
    .select('id, title, token, created_at')
    .maybeSingle();
  res.json({ report: data });
}));

// Public read-only view by share token (no auth). Must be before /:id.
router.get('/shared/:token', wrap(async (req, res) => {
  const { data } = await insforge.database
    .from('reports')
    .select('id, title, content, created_at')
    .eq('token', req.params.token)
    .maybeSingle();
  if (!data) return res.status(404).json({ error: 'Not found' });
  let content = null;
  try { content = data.content ? JSON.parse(data.content) : null; } catch { content = null; }
  res.json({ report: { ...data, content } });
}));

// Fetch one saved report (full content), scoped to the workspace.
router.get('/:id', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { data } = await insforge.database
    .from('reports')
    .select()
    .eq('id', req.params.id)
    .eq('workspace_id', req.workspaceId)
    .maybeSingle();
  if (!data) return res.status(404).json({ error: 'Not found' });
  let content = null;
  try { content = data.content ? JSON.parse(data.content) : null; } catch { content = null; }
  res.json({ report: { ...data, content } });
}));

// Compare a saved report's market distribution to the current workspace snapshot.
router.get('/:id/distribution-diff', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { data } = await insforge.database
    .from('reports')
    .select('content')
    .eq('id', req.params.id)
    .eq('workspace_id', req.workspaceId)
    .maybeSingle();
  if (!data) return res.status(404).json({ error: 'Not found' });

  let reportContent = null;
  try { reportContent = data.content ? JSON.parse(data.content) : null; } catch { reportContent = null; }

  let current = null;
  try {
    const raw = await getSetting(distributionSnapshotKey(req.workspaceId));
    current = raw ? JSON.parse(raw) : null;
  } catch { /* ignore */ }

  const diff = diffReportDistribution(reportContent?.market, current);
  res.json({ diff, current_captured_at: current?.captured_at || null });
}));

router.delete('/:id', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  await insforge.database
    .from('reports')
    .delete()
    .eq('id', req.params.id)
    .eq('workspace_id', req.workspaceId);
  res.json({ ok: true });
}));

export default router;
