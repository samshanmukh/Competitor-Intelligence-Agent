// End-to-end test of the real data layer.
//
// Unlike pg-client.test.js (which drives the query builder directly), this boots
// server/db/*.js exactly as the server does — through the `pg` driver, over a
// TCP socket, against a real Postgres engine — and calls the same exported
// functions the routes call. It is the check that the PostgreSQL adapter
// left application behaviour unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const schemaPath = fileURLToPath(new URL('../server/db/schema.sql', import.meta.url));

const PORT = 55432;
const pglite = new PGlite();
await pglite.exec(await readFile(schemaPath, 'utf8'));

const socketServer = new PGLiteSocketServer({ db: pglite, port: PORT, host: '127.0.0.1' });
await socketServer.start();

// Must be set before importing the db module — it builds its pool at load time.
process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`;

const db = await import('../server/db/index.js');
const workspaceDb = await import('../server/db/workspace.js');
const productDb = await import('../server/db/products.js');
const marketDb = await import('../server/db/marketModel.js');

test('probeDatabase reports a healthy connection', async () => {
  const result = await db.probeDatabase();
  assert.equal(result.ok, true, `probe failed: ${result.error}`);
});

test('ensureUserHasWorkspace creates a workspace and membership on first use', async () => {
  const userId = 'user-abcdef12';
  const ws = await workspaceDb.ensureUserHasWorkspace(userId, 'sam@example.com');

  assert.ok(ws.id, 'no workspace returned');
  assert.equal(ws.name, "sam's Workspace");
  assert.equal(ws.plan, 'free');
  assert.equal(await workspaceDb.isWorkspaceMember(userId, ws.id), true);

  // Idempotent: a second call reuses the existing workspace.
  const again = await workspaceDb.ensureUserHasWorkspace(userId, 'sam@example.com');
  assert.equal(again.id, ws.id);

  // This is the exact read that powers the app's post-login bootstrap and was
  // the call failing in production.
  const list = await workspaceDb.getUserWorkspaces(userId);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, ws.id);
  assert.equal(list[0].role, 'admin');
});

test('settings scope per workspace and globally', async () => {
  const ws = await workspaceDb.createWorkspace({
    name: 'Settings WS', slug: 'settings-ws', ownerId: 'user-settings',
  });

  await db.setSetting('webhook_url', 'https://hooks.example/a', ws.id);
  await db.setSetting('webhook_url', 'https://hooks.example/global');

  assert.equal(await db.getSetting('webhook_url', null, ws.id), 'https://hooks.example/a');
  assert.equal(await db.getSetting('webhook_url'), 'https://hooks.example/global');
  assert.equal(await db.getSetting('missing', 'fallback', ws.id), 'fallback');

  // Overwrite must update in place, not accumulate rows.
  await db.setSetting('webhook_url', 'https://hooks.example/b', ws.id);
  assert.equal(await db.getSetting('webhook_url', null, ws.id), 'https://hooks.example/b');

  const scoped = await db.getAllSettings(ws.id);
  assert.equal(scoped.webhook_url, 'https://hooks.example/b');

  const global = await db.getAllSettings();
  assert.equal(global.webhook_url, 'https://hooks.example/global');
  assert.ok(!('workspace' in global), 'workspace-scoped keys leaked into global settings');
});

test('competitor lifecycle: upsert, list, status, dedupe, delete', async () => {
  const ws = await workspaceDb.createWorkspace({
    name: 'Comp WS', slug: 'comp-ws', ownerId: 'user-comp',
  });

  const created = await db.upsertCompetitor({
    name: 'Zeta', website: 'https://zeta.test', pricing_url: 'https://zeta.test/pricing',
    workspace_id: ws.id,
  });
  assert.equal(created.name, 'Zeta');
  assert.equal(created.status, 'pending');

  // Same pricing URL in the same workspace returns the existing row.
  const duplicate = await db.upsertCompetitor({
    name: 'Zeta Again', pricing_url: 'https://zeta.test/pricing', workspace_id: ws.id,
  });
  assert.equal(duplicate.id, created.id);

  const approved = await db.updateCompetitorStatus(created.id, 'approved', ws.id);
  assert.equal(approved.status, 'approved');

  await db.upsertCompetitor({
    name: 'Alpha', pricing_url: 'https://alpha.test/pricing',
    workspace_id: ws.id, status: 'approved',
  });

  // listCompetitors orders by name ascending.
  const approvedList = await db.listCompetitors('approved', ws.id);
  assert.deepEqual(approvedList.map((c) => c.name), ['Alpha', 'Zeta']);

  const fetched = await db.getCompetitor(created.id, ws.id);
  assert.equal(fetched.id, created.id);
  // Workspace scoping must actually filter.
  assert.equal(await db.getCompetitor(created.id, 999999), null);

  const checked = await db.setCompetitorChecked(created.id, { error: null, changed: true });
  assert.match(checked.last_checked_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(checked.last_changed_at, /^\d{4}-\d{2}-\d{2}T/);

  await db.deleteCompetitor(created.id, ws.id);
  assert.equal(await db.getCompetitor(created.id, ws.id), null);
});

test('snapshots and changes: latest, listing, unseen count, mark seen', async () => {
  const ws = await workspaceDb.createWorkspace({
    name: 'Snap WS', slug: 'snap-ws', ownerId: 'user-snap',
  });
  const competitor = await db.upsertCompetitor({
    name: 'Monitor', pricing_url: 'https://monitor.test/pricing', workspace_id: ws.id,
  });

  const first = await db.insertSnapshot(competitor.id, 'price: $10', 'web');
  const second = await db.insertSnapshot(competitor.id, 'price: $20', 'web');

  assert.equal(first.content_hash, db.hashContent('price: $10'));
  const latest = await db.getLatestSnapshot(competitor.id);
  assert.equal(latest.id, second.id, 'latest snapshot should be the newest row');

  assert.equal((await db.listSnapshots(competitor.id)).length, 2);
  assert.equal((await db.getSnapshot(first.id)).content, 'price: $10');

  const change = await db.insertChange({
    competitor_id: competitor.id,
    snapshot_id: second.id,
    prev_snapshot_id: first.id,
    diff: '-$10 +$20',
    summary: 'Price increased',
    analysis: { severity: 'high' },
  });
  assert.equal(change.summary, 'Price increased');
  assert.deepEqual(JSON.parse(change.analysis), { severity: 'high' });

  assert.equal((await db.listChanges(competitor.id)).length, 1);

  // The embedded-join read behind the dashboard feed.
  const recent = await db.listRecentChanges(50, ws.id);
  const mine = recent.find((r) => r.id === change.id);
  assert.ok(mine, 'change missing from recent feed');
  assert.equal(mine.competitor_name, 'Monitor');

  assert.ok((await db.countUnseenChanges(ws.id)) >= 1);
  await db.markChangesSeen(ws.id);
  assert.equal(await db.countUnseenChanges(ws.id), 0);
});

test('product profile upserts in place per workspace', async () => {
  const ws = await workspaceDb.createWorkspace({
    name: 'Prod WS', slug: 'prod-ws', ownerId: 'user-prod',
  });

  assert.equal(await productDb.getProduct(ws.id), null);

  const created = await productDb.upsertProduct(ws.id, {
    name: 'Mira', description: 'CI agent', pricing_url: 'https://joinmira.ai/pricing',
  });
  assert.equal(created.name, 'Mira');

  // A partial update must preserve untouched fields.
  const updated = await productDb.upsertProduct(ws.id, { description: 'Updated blurb' });
  assert.equal(updated.id, created.id);
  assert.equal(updated.name, 'Mira');
  assert.equal(updated.description, 'Updated blurb');
  assert.equal(updated.pricing_url, 'https://joinmira.ai/pricing');
});

test('market model saves, overwrites, and records history', async () => {
  const ws = await workspaceDb.createWorkspace({
    name: 'Market WS', slug: 'market-ws', ownerId: 'user-market',
  });

  assert.equal(await marketDb.getMarketModel(ws.id), null);

  const v1 = { tam: { value_usd: 1000 }, sam: { value_usd: 100 }, som: { value_usd: 10 },
    inputs: { geography: 'US' } };
  await marketDb.saveMarketModel(ws.id, null, v1);
  assert.equal((await marketDb.getMarketModel(ws.id)).tam.value_usd, 1000);

  const v2 = { ...v1, tam: { value_usd: 2000 } };
  await marketDb.saveMarketModel(ws.id, null, v2);
  assert.equal((await marketDb.getMarketModel(ws.id)).tam.value_usd, 2000,
    'saveMarketModel should overwrite the single live row');

  await marketDb.insertModelHistory(ws.id, null, v1);
  await marketDb.insertModelHistory(ws.id, null, v2);
  const history = await marketDb.getModelHistory(ws.id, 6);
  assert.equal(history.length, 2);
  assert.equal(history[0].geography, 'US');
  assert.ok(history.every((h) => typeof h.tam === 'number'));
});

test('legacy workspace invites can still be claimed', async () => {
  const ws = await workspaceDb.createWorkspace({
    name: 'Invite WS', slug: 'invite-ws', ownerId: 'user-owner',
  });

  await workspaceDb.addWorkspaceMember(ws.id, 'invited:new@example.com', 'analyst', 'new@example.com');
  assert.ok(await workspaceDb.findPendingInvite(ws.id, 'new@example.com'));

  const claimed = await workspaceDb.claimPendingInvites('user-new', 'new@example.com');
  assert.equal(claimed.length, 1);
  assert.equal(await workspaceDb.isWorkspaceMember('user-new', ws.id), true);
  assert.equal(await workspaceDb.findPendingInvite(ws.id, 'new@example.com'), null);
});

test('digest workspaces require both the flag and an address', async () => {
  const withEmail = await workspaceDb.createWorkspace({
    name: 'Digest A', slug: 'digest-a', ownerId: 'user-da',
  });
  const withoutEmail = await workspaceDb.createWorkspace({
    name: 'Digest B', slug: 'digest-b', ownerId: 'user-db',
  });

  await workspaceDb.updateWorkspace(withEmail.id, {
    digest_enabled: true, digest_email: 'digest@example.com',
  });
  await workspaceDb.updateWorkspace(withoutEmail.id, { digest_enabled: true });

  const ids = (await workspaceDb.listDigestWorkspaces()).map((w) => w.id);
  assert.ok(ids.includes(withEmail.id));
  assert.ok(!ids.includes(withoutEmail.id), 'workspace without a digest address was included');
});

test.after(async () => {
  await db.pool.end();
  await socketServer.stop();
  await pglite.close();
});
