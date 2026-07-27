import { getWorkspace } from '../db/workspace.js';
import { resolveEntitlements, hasFeature } from '../services/entitlements.js';

/** Attach req.entitlements from user email + active workspace plan. */
export async function attachEntitlements(req, res, next) {
  try {
    const email = req.user?.email;
    let plan = 'free';
    const wsId = req.workspaceId || Number(req.headers['x-workspace-id']);
    if (wsId && Number.isFinite(wsId)) {
      const ws = await getWorkspace(wsId).catch(() => null);
      if (ws?.plan) plan = ws.plan;
    }
    req.entitlements = resolveEntitlements(email, plan);
    req.accountTier = req.entitlements.tier;
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a product feature for the current account tier. */
export function requireFeature(feature) {
  return (req, res, next) => {
    const run = async () => {
      if (!req.entitlements) {
        await new Promise((resolve, reject) => {
          attachEntitlements(req, res, (err) => (err ? reject(err) : resolve()));
        });
      }
      if (!hasFeature(req.entitlements, feature)) {
        return res.status(403).json({
          error: 'This feature requires a higher plan or admin access.',
          code: 'FEATURE_FORBIDDEN',
          feature,
          tier: req.entitlements?.tier || 'free_user',
        });
      }
      return next();
    };
    Promise.resolve(run()).catch(next);
  };
}
