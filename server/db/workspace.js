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
  return ws;
}

export async function isWorkspaceMember(userId, workspaceId) {
  if (!userId || !Number.isFinite(Number(workspaceId))) return false;
  const { data } = await insforge.database
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

export async function getWorkspaceMember(userId, workspaceId) {
  if (!userId || !Number.isFinite(Number(workspaceId))) return null;
  const { data } = await insforge.database
    .from('workspace_members')
    .select()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
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

export async function claimPendingInvites(userId, email) {
  if (!userId || !email) return [];
  const pendingId = `invited:${email.toLowerCase()}`;
  const { data: pending } = await insforge.database
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
  const { data } = await insforge.database
    .from('workspace_members')
    .select()
    .eq('workspace_id', workspaceId)
    .eq('user_id', pendingId)
    .maybeSingle();
  return data;
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
