// In-memory key cache — loaded from Insforge settings on startup so keys set
// via the UI survive server restarts. Falls back to process.env if not in DB.

const KEY_NAMES = ['YOUCOM_API_KEY', 'XAI_API_KEY', 'XAI_MODEL'];
const cache = {};

export function getKey(name) {
  return cache[name] || process.env[name] || null;
}

export function setKey(name, value) {
  if (value) {
    cache[name] = value;
  } else {
    delete cache[name];
  }
}

export async function loadKeysFromDB(getSetting) {
  for (const name of KEY_NAMES) {
    const value = await getSetting(`key:${name}`);
    if (value) cache[name] = value;
  }
}
