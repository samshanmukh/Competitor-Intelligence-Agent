import databaseClient, { unwrap } from './index.js';

export async function getUserWorkspaces(userId) {
  const data = unwrap(
    await databaseClient.database
      .from('workspace_members')
      .select('role, workspace_id, workspaces(id, name, slug, plan, created_at)')
      .eq('user_id', userId),
    'loading your workspaces'
  );
  return (data || []).map((m) => ({ ...m.workspaces, role: m.role }));
}

export async function getAllWorkspaces() {
  const data = unwrap(
    await databaseClient.database
      .from('workspaces')
      .select('id, name, slug, plan, created_at')
      .order('id', { ascending: true }),
    'loading workspaces'
  );
  return data || [];
}

export async function createWorkspace({ name, slug, ownerId }) {
  const ws = unwrap(
    await databaseClient.database
      .from('workspaces')
      .insert({ name, slug, owner_id: ownerId, plan: 'free' })
      .select()
      .maybeSingle(),
    'creating your workspace'
  );
  if (!ws) throw new Error('Failed to create workspace');
  unwrap(
    await databaseClient.database.from('workspace_members').insert({
      workspace_id: ws.id,
      user_id: ownerId,
      role: 'admin',
    }),
    'adding you to the new workspace'
  );
  return ws;
}

export async function ensureUserHasWorkspace(userId, email) {
  const workspaces = await getUserWorkspaces(userId);
  if (workspaces.length > 0) return workspaces[0];

  const slug = `ws-${userId.slice(-8)}-${Date.now().toString(36)}`;
  const name = email ? `${email.split('@')[0]}'s Workspace` : 'My Workspace';
  const ws = await createWorkspace({ name, slug, ownerId: userId });
  return ws;
}

/**
 * Resolve the shared app workspace. DEFAULT_WORKSPACE_ID can pin a deployment
 * to one workspace; otherwise preserve existing data by choosing the oldest.
 */
export async function getDefaultWorkspace() {
  const configuredId = Number(process.env.DEFAULT_WORKSPACE_ID);
  if (Number.isFinite(configuredId) && configuredId > 0) {
    const configured = await getWorkspace(configuredId);
    if (configured) return configured;
  }

  const workspaces = await getAllWorkspaces();
  if (workspaces[0]) return workspaces[0];
  return createWorkspace({
    name: 'Mira Workspace',
    slug: `mira-${Date.now().toString(36)}`,
    ownerId: 'mira-app',
  });
}

export async function isWorkspaceMember(userId, workspaceId) {
  if (!userId || !Number.isFinite(Number(workspaceId))) return false;
  const data = unwrap(
    await databaseClient.database
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
    'checking your workspace membership'
  );
  return Boolean(data);
}

export async function getWorkspaceMember(userId, workspaceId) {
  if (!userId || !Number.isFinite(Number(workspaceId))) return null;
  const { data } = await databaseClient.database
    .from('workspace_members')
    .select()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function getWorkspace(id) {
  const { data } = await databaseClient.database
    .from('workspaces')
    .select()
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function getWorkspaceMembers(workspaceId) {
  const { data } = await databaseClient.database
    .from('workspace_members')
    .select()
    .eq('workspace_id', workspaceId);
  return data || [];
}

export async function addWorkspaceMember(workspaceId, userId, role = 'analyst', invitedEmail = null) {
  const { data } = await databaseClient.database
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: userId, role, invited_email: invitedEmail })
    .select()
    .maybeSingle();
  return data;
}

export async function removeWorkspaceMember(workspaceId, userId) {
  await databaseClient.database
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
}

export async function listDigestWorkspaces() {
  const { data } = await databaseClient.database
    .from('workspaces')
    .select()
    .eq('digest_enabled', true);
  return (data || []).filter((w) => w.digest_email);
}

export async function claimPendingInvites(userId, email) {
  if (!userId || !email) return [];
  const pendingId = `invited:${email.toLowerCase()}`;
  const { data: pending } = await databaseClient.database
    .from('workspace_members')
    .select()
    .eq('user_id', pendingId);
  const claimed = [];
  for (const row of pending || []) {
    // Skip if already a real member of this workspace.
    const already = await isWorkspaceMember(userId, row.workspace_id);
    if (already) {
      await removeWorkspaceMember(row.workspace_id, pendingId);
      continue;
    }
    await removeWorkspaceMember(row.workspace_id, pendingId);
    const member = await addWorkspaceMember(row.workspace_id, userId, row.role || 'analyst', null);
    if (member) claimed.push(member);
  }
  return claimed;
}

export async function findPendingInvite(workspaceId, email) {
  if (!workspaceId || !email) return null;
  const pendingId = `invited:${email.toLowerCase()}`;
  const { data } = await databaseClient.database
    .from('workspace_members')
    .select()
    .eq('workspace_id', workspaceId)
    .eq('user_id', pendingId)
    .maybeSingle();
  return data;
}

export async function updateWorkspace(id, updates) {
  const { data } = await databaseClient.database
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  return data;
}
