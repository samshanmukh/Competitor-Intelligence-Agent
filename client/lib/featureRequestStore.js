import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const VISITOR_COOKIE = 'mira_feature_visitor';
const DEFAULT_STORE = {
  nextRequestId: 1,
  nextVoteId: 1,
  requests: [],
  votes: [],
};

let mutationQueue = Promise.resolve();
let fallbackPath = null;

function configuredPath() {
  return process.env.FEATURE_REQUESTS_JSON_PATH
    || join(process.cwd(), 'data', 'feature-requests.json');
}

function storePath() {
  return fallbackPath || configuredPath();
}

function normalizeStore(value) {
  return {
    nextRequestId: Number(value?.nextRequestId) || 1,
    nextVoteId: Number(value?.nextVoteId) || 1,
    requests: Array.isArray(value?.requests) ? value.requests : [],
    votes: Array.isArray(value?.votes) ? value.votes : [],
  };
}

async function readStoreAt(path) {
  try {
    return normalizeStore(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(DEFAULT_STORE);
    throw error;
  }
}

export async function readFeatureRequestStore() {
  return readStoreAt(storePath());
}

async function persistStore(value) {
  let path = storePath();
  const write = async () => {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, path);
  };

  try {
    await write();
  } catch (error) {
    // Some serverless hosts mount the application bundle read-only. Keep the
    // dependency-free board usable for that process via its writable /tmp.
    if (!['EACCES', 'EROFS'].includes(error?.code) || fallbackPath) throw error;
    fallbackPath = join('/tmp', 'mira-feature-requests.json');
    path = fallbackPath;
    await write();
  }
}

export async function updateFeatureRequestStore(mutator) {
  let result;
  mutationQueue = mutationQueue.catch(() => {}).then(async () => {
    const store = await readFeatureRequestStore();
    result = await mutator(store);
    await persistStore(store);
  });
  await mutationQueue;
  return result;
}

export function visitorIdentity(request) {
  const raw = request.cookies.get(VISITOR_COOKIE)?.value || '';
  const id = /^[0-9a-f-]{36}$/i.test(raw) ? raw : randomUUID();
  return {
    key: createHash('sha256').update(`${id}|mira-feature-votes`).digest('hex'),
    cookieValue: id,
    isNew: raw !== id,
  };
}

export function attachVisitorCookie(response, identity) {
  if (identity?.isNew) {
    response.cookies.set(VISITOR_COOKIE, identity.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
