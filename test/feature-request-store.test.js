import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('feature-request store serializes JSON mutations without losing data', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mira-feature-requests-'));
  const storePath = join(directory, 'requests.json');
  process.env.FEATURE_REQUESTS_JSON_PATH = storePath;
  t.after(async () => {
    delete process.env.FEATURE_REQUESTS_JSON_PATH;
    await rm(directory, { recursive: true, force: true });
  });

  const {
    readFeatureRequestStore,
    updateFeatureRequestStore,
  } = await import('../client/lib/featureRequestStore.js');

  await updateFeatureRequestStore((store) => {
    store.requests.push({
      id: store.nextRequestId++,
      title: 'Export a CSV',
      priority: 'high',
      status: 'open',
      creatorKey: 'visitor-a',
      created_at: '2026-09-01T00:00:00.000Z',
    });
    return null;
  });

  await Promise.all([
    updateFeatureRequestStore((store) => {
      store.votes.push({ id: store.nextVoteId++, requestId: 1, voterKey: 'visitor-a' });
    }),
    updateFeatureRequestStore((store) => {
      store.requests[0].title = 'Export reports as CSV';
    }),
  ]);

  const stored = await readFeatureRequestStore();
  assert.equal(stored.requests[0].title, 'Export reports as CSV');
  assert.equal(stored.votes.length, 1);
  assert.equal(stored.nextRequestId, 2);
  assert.equal(stored.nextVoteId, 2);

  const parsedFile = JSON.parse(await readFile(storePath, 'utf8'));
  assert.deepEqual(parsedFile, stored);
});
