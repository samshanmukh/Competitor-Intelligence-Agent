// Per-workspace in-memory key cache. Workspace values are hydrated by
// resolveWorkspace; process.env remains the server-wide fallback.
import { getCurrentWorkspaceId } from './requestContext.js';

const cache = {};
const workspaceCache = new Map();

export function getKey(name, workspaceId = getCurrentWorkspaceId()) {
  return workspaceCache.get(String(workspaceId))?.[name] || cache[name] || process.env[name] || null;
}

export function setKey(name, value, workspaceId = getCurrentWorkspaceId()) {
  if (workspaceId != null) {
    const id = String(workspaceId);
    const values = workspaceCache.get(id) || {};
    if (value) values[name] = value;
    else delete values[name];
    workspaceCache.set(id, values);
    return;
  }
  if (value) {
    cache[name] = value;
  } else {
    delete cache[name];
  }
}
