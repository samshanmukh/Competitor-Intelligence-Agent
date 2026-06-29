import { getToken, getWorkspace, refreshAccessToken, forceLogout } from './auth.js';

function getHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const token = typeof window !== 'undefined' ? getToken() : null;
  const workspace = typeof window !== 'undefined' ? getWorkspace() : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (workspace?.id) headers['X-Workspace-Id'] = String(workspace.id);
  return headers;
}

const AUTH_ERROR_CODES = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHENTICATED']);

// In dev, call the backend directly (NEXT_PUBLIC_API_BASE) to bypass the Next.js
// proxy's 30s timeout on long-running requests. In prod this is empty (same-origin).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function request(path, { method = 'GET', body, headers: extraHeaders } = {}, _retried = false) {
  const headers = getHeaders(extraHeaders);
  if (!body) delete headers['Content-Type'];
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }

  if (!res.ok) {
    // On an expired/invalid session, try a silent refresh once, then retry.
    if (res.status === 401 && !_retried && AUTH_ERROR_CODES.has(data?.code) && typeof window !== 'undefined') {
      const newToken = await refreshAccessToken();
      if (newToken) return request(path, { method, body, headers: extraHeaders }, true);
      // Couldn't recover — send the user to re-authenticate.
      forceLogout();
    }
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  discover: (payload) => request('/discover', { method: 'POST', body: payload }),

  listCompetitors: (status) =>
    request(`/competitors${status ? `?status=${status}` : ''}`),
  addCompetitors: (competitors, status = 'approved') =>
    request('/competitors', { method: 'POST', body: { competitors, status } }),
  getCompetitor: (id) => request(`/competitors/${id}`),
  setStatus: (id, status) =>
    request(`/competitors/${id}`, { method: 'PATCH', body: { status } }),
  deleteCompetitor: (id) => request(`/competitors/${id}`, { method: 'DELETE' }),
  getSnapshot: (id, snapshotId) =>
    request(`/competitors/${id}/snapshots/${snapshotId}`),

  refreshOne: (id) => request(`/competitors/${id}/refresh`, { method: 'POST' }),
  refreshAll: () => request('/refresh', { method: 'POST' }),

  changes: (limit = 50) => request(`/changes?limit=${limit}`),
  unseenCount: () => request('/changes/unseen-count'),
  markSeen: () => request('/changes/mark-seen', { method: 'POST' }),

  getSettings: () => request('/settings'),
  saveSettings: (payload) => request('/settings', { method: 'PUT', body: payload }),
  recordVisit: () => request('/visit', { method: 'POST' }),

  // Auth
  me: () => request('/auth/me', { headers: {} }),
  workspaces: () => request('/auth/workspaces', { headers: {} }),
  createWorkspace: (name) => request('/auth/workspaces', { method: 'POST', body: { name } }),
  workspaceMembers: (id) => request(`/auth/workspaces/${id}/members`, { headers: {} }),
  inviteMember: (id, email, role) => request(`/auth/workspaces/${id}/members`, { method: 'POST', body: { email, role } }),

  // Product
  getProduct: () => request('/products', { headers: {} }),
  saveProduct: (payload) => request('/products', { method: 'POST', body: payload }),
  inferProduct: (url) => request('/products/infer', { method: 'POST', body: { url } }),

  // Intelligence
  priceHistory: (id) => request(`/intelligence/competitors/${id}/price-history`),
  featureMatrix: (ids) => request('/intelligence/feature-matrix', { method: 'POST', body: { competitorIds: ids } }),
  positioning: () => request('/intelligence/positioning', { method: 'POST' }),
  battlecard: (id) => request(`/intelligence/competitors/${id}/battlecard`, { method: 'POST' }),
  valueScore: (id) => request(`/intelligence/competitors/${id}/value-score`, { method: 'POST' }),
  reviews: (ids) => request('/intelligence/reviews', { method: 'POST', body: { competitorIds: ids } }),
  analystTake: () => request('/intelligence/analyst-take', { method: 'POST' }),

  // Saved report history
  saveReport: (title, content) => request('/reports', { method: 'POST', body: { title, content } }),
  listReports: () => request('/reports'),
  getReport: (id) => request(`/reports/${id}`),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),

  // Push
  vapidKey: () => request('/push/vapid-public-key'),
  pushSubscribe: (subscription, alertTypes) =>
    request('/push/subscribe', { method: 'POST', body: { subscription, alertTypes } }),
  pushUnsubscribe: (endpoint) =>
    request('/push/unsubscribe', { method: 'DELETE', body: { endpoint } }),
};
