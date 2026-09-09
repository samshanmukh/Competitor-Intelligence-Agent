const WORKSPACE_KEY = 'cia_workspace';
const WORKSPACE_MAX_AGE = 60 * 60 * 24 * 365;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function getWorkspace() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(WORKSPACE_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function cookieSecureFlag() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

export function saveWorkspace(workspace) {
  if (typeof window === 'undefined' || !workspace?.id) return;
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  document.cookie = `cia_workspace_id=${workspace.id}; path=/; max-age=${WORKSPACE_MAX_AGE}; SameSite=Lax${cookieSecureFlag()}`;
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

export async function fetchWorkspaces() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/workspaces`);
    if (!response.ok) return [];
    const { workspaces = [] } = await readJsonSafe(response);
    const selected = getWorkspace();
    if (!selected || !workspaces.some((workspace) => String(workspace.id) === String(selected.id))) {
      if (workspaces[0]) saveWorkspace(workspaces[0]);
    }
    return workspaces;
  } catch {
    return [];
  }
}

export function switchWorkspace(workspace) {
  saveWorkspace(workspace);
  window.location.reload();
}
