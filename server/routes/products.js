import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { getProduct, upsertProduct } from '../db/products.js';
import { inferProductFromUrl } from '../agents/discoveryAgent.js';
import { ensureHttps } from '../lib/normalizeUrl.js';

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
  const product = await upsertProduct(req.workspaceId, {
    name,
    description,
    pricing_url: pricing_url != null ? (ensureHttps(pricing_url) || null) : pricing_url,
    logo_url,
    pricing_data,
  });
  res.json({ product });
}));

// Search-first company identity from a product URL (sparkle auto-fill).
// WebSearch is the source of truth; does not depend on Contents/SPA scrapes.
router.post('/infer', requireAuth, resolveWorkspace, wrap(async (req, res) => {
  const { url } = req.body || {};
  const normalized = ensureHttps(url);
  if (!normalized) return res.status(400).json({ error: 'url required' });
  const { name, description, source } = await inferProductFromUrl(normalized);
  res.json({ name, description, source });
}));

export default router;
