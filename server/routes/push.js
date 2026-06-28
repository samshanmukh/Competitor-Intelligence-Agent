import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { saveSubscription, removeSubscription, VAPID_PUBLIC } from '../services/push.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

router.post('/subscribe', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { subscription, alertTypes } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  await saveSubscription(req.user.id, req.workspaceId, subscription, alertTypes || ['any']);
  res.json({ ok: true });
}));

router.delete('/unsubscribe', requireAuth, wrap(async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await removeSubscription(req.user.id, endpoint);
  res.json({ ok: true });
}));

export default router;
