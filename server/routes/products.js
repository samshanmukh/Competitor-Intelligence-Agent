import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { getProduct, upsertProduct } from '../db/products.js';
import { inferMarketFromUrl } from '../agents/discoveryAgent.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get the workspace's product profile
router.get('/', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const product = await getProduct(req.workspaceId);
  res.json({ product: product || null });
}));

// Create/update the workspace's product profile
router.post('/', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { name, description, pricing_url, logo_url, pricing_data } = req.body || {};
  const product = await upsertProduct(req.workspaceId, { name, description, pricing_url, logo_url, pricing_data });
  res.json({ product });
}));

// Read a product URL and infer a market description (used for the optional auto-fill).
router.post('/infer', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
  const description = await inferMarketFromUrl(normalized);
  res.json({ description });
}));

export default router;
