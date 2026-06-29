import insforge from './index.js';

export async function getUserWorkspaces(userId) {
  const { data } = await insforge.database
    .from('workspace_members')
    .select('role, workspace_id, workspaces(id, name, slug, plan, created_at)')
    .eq('user_id', userId);
  return (data || []).map((m) => ({ ...m.workspaces, role: m.role }));
}

export async function createWorkspace({ name, slug, ownerId }) {
  const { data: ws } = await insforge.database
    .from('workspaces')
    .insert({ name, slug, owner_id: ownerId, plan: 'free' })
    .select()
    .maybeSingle();
  if (!ws) throw new Error('Failed to create workspace');
  await insforge.database.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: ownerId,
    role: 'admin',
  });
  return ws;
}

export async function ensureUserHasWorkspace(userId, email) {
  const workspaces = await getUserWorkspaces(userId);
  if (workspaces.length > 0) return workspaces[0];

  const slug = `ws-${userId.slice(-8)}-${Date.now().toString(36)}`;
  const name = email ? `${email.split('@')[0]}'s Workspace` : 'My Workspace';
  const ws = await createWorkspace({ name, slug, ownerId: userId });

  // Migrate any unscoped competitors to this new workspace.
  await insforge.database
    .from('competitors')
    .update({ workspace_id: ws.id })
    .is('workspace_id', null);

  return ws;
}

export async function getWorkspace(id) {
  const { data } = await insforge.database
    .from('workspaces')
    .select()
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function getWorkspaceMembers(workspaceId) {
  const { data } = await insforge.database
    .from('workspace_members')
    .select()
    .eq('workspace_id', workspaceId);
  return data || [];
}

export async function addWorkspaceMember(workspaceId, userId, role = 'analyst', invitedEmail = null) {
  const { data } = await insforge.database
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: userId, role, invited_email: invitedEmail })
    .select()
    .maybeSingle();
  return data;
}

export async function removeWorkspaceMember(workspaceId, userId) {
  await insforge.database
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
}

export async function listDigestWorkspaces() {
  const { data } = await insforge.database
    .from('workspaces')
    .select()
    .eq('digest_enabled', true);
  return (data || []).filter((w) => w.digest_email);
}

export async function updateWorkspace(id, updates) {
  const { data } = await insforge.database
    .from('workspaces')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  return data;
}
