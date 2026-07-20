import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workspace resolution verifies tenant membership before trusting headers', async () => {
  const source = await projectFile('server/middleware/auth.js');
  const membershipCheck = source.indexOf('await isWorkspaceMember(req.user.id, wsId)');
  const assignment = source.indexOf('req.workspaceId = wsId');

  assert.match(source, /authorization.*startsWith\('Bearer '\)/s);
  assert.match(source, /sessions\/current/);
  assert.match(source, /status\(503\).*AUTH_UNAVAILABLE/s);
  assert.ok(membershipCheck > -1, 'workspace membership check must remain present');
  assert.ok(
    assignment > membershipCheck,
    'the workspace ID must only be assigned after membership is verified',
  );
  assert.match(source, /status\(403\).*FORBIDDEN_WORKSPACE/s);
});

test('tenant-data routers retain authentication and workspace resolution', async () => {
  const protectedRouters = [
    'server/routes/api.js',
    'server/routes/features.js',
    'server/routes/intelligence.js',
    'server/routes/products.js',
    'server/routes/reports.js',
  ];

  for (const path of protectedRouters) {
    const source = await projectFile(path);
    assert.match(source, /\brequireAuth\b/, `${path} must require authentication`);
    assert.match(source, /\bresolveWorkspace\b/, `${path} must resolve an authorized workspace`);
  }

  const apiSource = await projectFile('server/routes/api.js');
  assert.ok(
    apiSource.indexOf("router.get('/health'") < apiSource.indexOf('router.use(requireAuth, resolveWorkspace)'),
    'only explicitly public API routes may appear before the tenant guard',
  );
  assert.ok(
    apiSource.indexOf("'/competitors'") > apiSource.indexOf('router.use(requireAuth, resolveWorkspace)'),
    'competitor routes must remain behind the tenant guard',
  );
});

test('mobile shell keeps responsive navigation and content overflow protection', async () => {
  const [shell, sidebar] = await Promise.all([
    projectFile('client/components/AppShell.jsx'),
    projectFile('client/components/Sidebar.jsx'),
  ]);

  assert.match(shell, /<main className="[^"]*\bmin-w-0\b/);
  assert.match(sidebar, /<aside className=\{`[^`]*\bhidden\b[^`]*\bmd:flex\b/);
  assert.match(sidebar, /Mobile top bar[\s\S]*\bmd:hidden\b/);
  assert.match(sidebar, /Mobile top bar[\s\S]*\bsticky\b[^"]*\btop-0\b/);
  assert.match(sidebar, /href="\/app"[\s\S]*href="\/competitors"[\s\S]*href="\/settings"/);
});

test('auth and shared-report pages remain outside the private app shell', async () => {
  const [shell, middleware] = await Promise.all([
    projectFile('client/components/AppShell.jsx'),
    projectFile('client/middleware.js'),
  ]);

  for (const prefix of ['/login', '/signup', '/oauth', '/auth', '/reports/shared', '/invite']) {
    assert.ok(shell.includes(`'${prefix}'`), `${prefix} must bypass the app shell`);
    assert.ok(middleware.includes(`'${prefix}'`), `${prefix} must remain publicly routable`);
  }
});

test('public ownership and report links retain abuse controls', async () => {
  const [visitorSource, reportSource] = await Promise.all([
    projectFile('client/lib/serverInsforge.js'),
    projectFile('server/routes/reports.js'),
  ]);

  assert.match(visitorSource, /FEATURE_REQUEST_SIGNING_SECRET/);
  assert.match(visitorSource, /httpOnly:\s*true/);
  assert.match(visitorSource, /timingSafeEqual/);
  assert.doesNotMatch(visitorSource, /x-forwarded-for|x-real-ip/);

  assert.match(reportSource, /SHARED_REPORT_TTL_DAYS/);
  assert.match(reportSource, /status\(410\).*SHARE_EXPIRED/s);
  assert.match(reportSource, /Cache-Control.*no-store/s);
});

test('no project-specific Insforge credentials are embedded in source', async () => {
  const files = [
    'client/lib/auth.js',
    'client/lib/serverInsforge.js',
    'client/app/auth/callback/page.jsx',
    'server/db/index.js',
    'server/middleware/auth.js',
  ];

  for (const path of files) {
    const source = await projectFile(path);
    assert.doesNotMatch(source, /anon_[a-f0-9]{32,}/i, `${path} must not embed an anon key`);
    assert.doesNotMatch(source, /https:\/\/[a-z0-9-]+\.insforge\.app/i, `${path} must not embed a backend URL`);
  }
});

test('scheduled refreshes execute with workspace-scoped provider keys', async () => {
  const [serverSource, executionSource] = await Promise.all([
    projectFile('server/index.js'),
    projectFile('server/services/workspaceExecution.js'),
  ]);

  assert.match(serverSource, /runWithWorkspaceKeys\(\s*workspaceId/s);
  assert.match(executionSource, /getSetting\(`key:\$\{name\}`,\s*null,\s*workspaceId\)/);
  assert.match(executionSource, /runWithWorkspace\(workspaceId,\s*fn\)/);
});

test('public health does not expose provider configuration and webhooks reject SSRF targets', async () => {
  const [apiSource, alertSource] = await Promise.all([
    projectFile('server/routes/api.js'),
    projectFile('server/services/alerts.js'),
  ]);

  assert.match(apiSource, /router\.get\('\/health'[\s\S]*?res\.json\(\{\s*ok:\s*true\s*\}\)/);
  assert.match(apiSource, /normalizeWebhookUrl\(webhook_url\)/);
  assert.match(apiSource, /hooks\.slack\.com/);
  assert.match(apiSource, /discord\.com/);
  assert.match(alertSource, /isAllowedWebhookUrl\(url\)/);
  assert.match(alertSource, /url\.protocol === 'https:'/);
});
