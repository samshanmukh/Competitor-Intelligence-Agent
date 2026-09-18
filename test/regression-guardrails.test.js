import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workspace resolution is account-free and validates selected workspace ids', async () => {
  const source = await projectFile('server/middleware/auth.js');
  const workspaceLookup = source.indexOf('await getWorkspace(workspaceId)');
  const assignment = source.indexOf('req.workspaceId = workspace.id');

  assert.match(source, /APP_USER/);
  assert.match(source, /getDefaultWorkspace\(\)/);
  assert.doesNotMatch(source, /authorization|sessions\/current|Bearer/);
  assert.ok(workspaceLookup > -1, 'selected workspace must be loaded before use');
  assert.ok(
    assignment > workspaceLookup,
    'the workspace ID must only be assigned after the workspace is resolved',
  );
  assert.match(source, /status\(404\).*WORKSPACE_NOT_FOUND/s);
});

test('workspace-data routers retain shared actor and workspace resolution', async () => {
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

  // `<main>` may carry a literal className or a conditional expression; every
  // branch must keep min-w-0 or long content forces the whole shell to scroll.
  const mainTag = shell.match(/<main\b[\s\S]*?>/)?.[0];
  assert.ok(mainTag, '<main> element missing from the app shell');
  const classNames = [...mainTag.matchAll(/'([^']*)'|"([^"]*)"/g)]
    .map((m) => m[1] ?? m[2])
    .filter((value) => value.includes('flex-1'));
  assert.ok(classNames.length, '<main> must set flex-1');
  for (const value of classNames) {
    assert.match(value, /\bmin-w-0\b/, `<main> class list missing min-w-0: ${value}`);
  }
  assert.match(sidebar, /<aside className=\{`[^`]*\bhidden\b[^`]*\bmd:flex\b/);
  assert.match(sidebar, /Mobile top bar[\s\S]*\bmd:hidden\b/);
  assert.match(sidebar, /Mobile top bar[\s\S]*\bsticky\b[^"]*\btop-0\b/);
  assert.match(sidebar, /href="\/app"[\s\S]*href="\/company"/);
  assert.match(sidebar, /label="Deep market search"/);
  assert.doesNotMatch(sidebar, /href="\/(?:analyst|market|distribution|competitors|compare|moves|changes|notifications|reports|positioning|pricing-lab|gaps|settings)"/);
  assert.doesNotMatch(sidebar, /WorkspaceSwitcher|api\.me|fetchWorkspaces/);
});

test('deep market search uses the Vercel-native You.com research route', async () => {
  const [route, client, api] = await Promise.all([
    projectFile('client/app/api/company/deep-dive/route.js'),
    projectFile('client/components/CompanyDeepDiveClient.jsx'),
    projectFile('client/lib/api.js'),
  ]);

  assert.match(route, /https:\/\/api\.you\.com\/v1\/research/);
  assert.match(route, /process\.env\.YOUCOM_API_KEY/);
  assert.doesNotMatch(route, /xai|grok|insforge|DATABASE_URL/i);
  assert.match(api, /deepDive:.*request\('\/company\/deep-dive'/);
  assert.doesNotMatch(api, /company\/deep-dive\/start|company\/deep-dive\/status/);
  assert.match(client, /title="Deep market search"/);
  assert.match(client, /Market model · size & growth/);
});

test('legacy auth URLs redirect to the open app and public tools stay outside its shell', async () => {
  const [shell, middleware] = await Promise.all([
    projectFile('client/components/AppShell.jsx'),
    projectFile('client/middleware.js'),
  ]);

  for (const prefix of ['/reports/shared', '/requests']) {
    assert.ok(shell.includes(`'${prefix}'`), `${prefix} must bypass the app shell`);
  }
  assert.match(middleware, /LEGACY_AUTH_PATHS[\s\S]*'\/login'[\s\S]*'\/signup'/);
  assert.match(middleware, /NextResponse\.redirect\(new URL\('\/app'/);
  assert.doesNotMatch(shell, /'\/login'|'\/signup'|'\/invite'/);
});

test('public ownership and report links retain abuse controls', async () => {
  const [visitorSource, reportSource] = await Promise.all([
    projectFile('client/lib/featureRequestStore.js'),
    projectFile('server/routes/reports.js'),
  ]);

  assert.match(visitorSource, /FEATURE_REQUESTS_JSON_PATH/);
  assert.match(visitorSource, /randomUUID/);
  assert.match(visitorSource, /httpOnly:\s*true/);
  assert.doesNotMatch(visitorSource, /x-forwarded-for|x-real-ip/);

  assert.match(reportSource, /SHARED_REPORT_TTL_DAYS/);
  assert.match(reportSource, /status\(410\).*SHARE_EXPIRED/s);
  assert.match(reportSource, /Cache-Control.*no-store/s);
});

test('removed backend credentials are not embedded in source', async () => {
  const files = [
    'client/lib/auth.js',
    'client/lib/featureRequestStore.js',
    'server/db/index.js',
    'server/middleware/auth.js',
  ];

  for (const path of files) {
    const source = await projectFile(path);
    assert.doesNotMatch(source, /anon_[a-f0-9]{32,}/i, `${path} must not embed an anon key`);
    assert.doesNotMatch(source, /https:\/\/[a-z0-9-]+\.[a-z]+\.app/i, `${path} must not embed a removed backend URL`);
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
