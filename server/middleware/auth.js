import { getDefaultWorkspace, getWorkspace } from '../db/workspace.js';
import { runWithWorkspaceKeys } from '../services/workspaceExecution.js';

/**
 * The app runs without accounts. Keep a stable actor on requests because a few
 * background-job and push-notification records still require a user identifier.
 */
export const APP_USER = Object.freeze({
  id: 'mira-app',
  email: null,
});

/**
 * Kept as middleware so existing route declarations stay simple. There is no
 * token parsing or external session validation in account-free mode.
 */
export function requireAuth(req, _res, next) {
  req.user = { ...APP_USER };
  next();
}

/** Resolve the selected shared workspace, or the app's default workspace. */
export async function resolveWorkspace(req, res, next) {
  try {
    const rawWorkspaceId = req.headers['x-workspace-id'];
    let workspace = null;

    if (rawWorkspaceId !== undefined) {
      const workspaceId = Number(rawWorkspaceId);
      if (!Number.isFinite(workspaceId)) {
        return res.status(400).json({ error: 'Invalid workspace id', code: 'BAD_WORKSPACE' });
      }
      workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' });
      }
    } else {
      workspace = await getDefaultWorkspace();
    }

    req.workspaceId = workspace.id;
    return runWithWorkspaceKeys(workspace.id, next);
  } catch (err) {
    next(err);
  }
}
