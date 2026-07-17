import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage();

export function runWithWorkspace(workspaceId, fn) {
  return requestContext.run({ workspaceId }, fn);
}

export function getCurrentWorkspaceId() {
  return requestContext.getStore()?.workspaceId ?? null;
}
