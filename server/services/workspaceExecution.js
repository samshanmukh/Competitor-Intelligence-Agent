import { getSetting } from '../db/index.js';
import { setKey } from './keys.js';
import { runWithWorkspace } from './requestContext.js';

const KEY_NAMES = ['YOUCOM_API_KEY', 'XAI_API_KEY', 'XAI_MODEL'];

export async function hydrateWorkspaceKeys(workspaceId) {
  const values = await Promise.all(
    KEY_NAMES.map((name) => getSetting(`key:${name}`, null, workspaceId))
  );
  KEY_NAMES.forEach((name, index) => {
    setKey(name, values[index] || null, workspaceId);
  });
}

export async function runWithWorkspaceKeys(workspaceId, fn) {
  await hydrateWorkspaceKeys(workspaceId);
  return runWithWorkspace(workspaceId, fn);
}
