import { getToken, getWorkspace, refreshAccessToken, forceLogout } from './auth.js';

function getHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const token = typeof window !== 'undefined' ? getToken() : null;
  const workspace = typeof window !== 'undefined' ? getWorkspace() : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (workspace?.id) headers['X-Workspace-Id'] = String(workspace.id);
  return headers;
}

// Only force re-auth when the session is genuinely missing/garbage — NOT on mere
// token expiry (the backend no longer rejects expired-but-decodable tokens, and
// auto-logging-out on expiry kicks users out on every reload).
const AUTH_ERROR_CODES = new Set(['INVALID_TOKEN', 'UNAUTHENTICATED']);

// In dev, call the backend directly (NEXT_PUBLIC_API_BASE) to bypass the Next.js
// proxy's 30s timeout on long-running requests. In prod this is empty (same-origin).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function request(path, { method = 'GET', body, headers: extraHeaders } = {}, _retried = false) {
  const headers = getHeaders(extraHeaders);
  if (!body) delete headers['Content-Type'];
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('Could not reach Mira AI. Check your connection and try again.');
    err.code = 'NETWORK_ERROR';
    throw err;
  }
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
    const message = data?.code === 'AUTH_UNAVAILABLE'
      ? 'Sign-in services are temporarily unavailable. Please try again shortly.'
      : data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
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
  getWorkspace: (id) => request(`/auth/workspaces/${id}`, { headers: {} }),
  updateWorkspace: (id, updates) => request(`/auth/workspaces/${id}`, { method: 'PATCH', body: updates }),
  digestTest: (id, email) => request(`/auth/workspaces/${id}/digest-test`, { method: 'POST', body: { email } }),

  // Product
  getProduct: () => request('/products', { headers: {} }),
  saveProduct: (payload) => request('/products', { method: 'POST', body: payload }),
  inferProduct: (url) => request('/products/infer', { method: 'POST', body: { url } }),

  // Intelligence
  priceHistory: (id) => request(`/intelligence/competitors/${id}/price-history`),
  featureMatrix: (ids, includeProduct = true) => request('/intelligence/feature-matrix', { method: 'POST', body: { competitorIds: ids, includeProduct } }),
  productAnalysis: () => request('/intelligence/product-analysis', { method: 'POST' }),
  positioning: () => request('/intelligence/positioning', { method: 'POST' }),
  battlecard: (id) => request(`/intelligence/competitors/${id}/battlecard`, { method: 'POST' }),
  valueScore: (id) => request(`/intelligence/competitors/${id}/value-score`, { method: 'POST' }),
  reviews: (ids) => request('/intelligence/reviews', { method: 'POST', body: { competitorIds: ids } }),
  analystTake: () => request('/intelligence/analyst-take', { method: 'POST' }),
  strategy: () => request('/intelligence/strategy', { method: 'POST' }),
  marketStart: (effort) => request('/intelligence/market/start', { method: 'POST', body: { effort } }),
  marketStatus: (jobId) => request(`/intelligence/market/status/${jobId}`),
  marketPulse: () => request('/intelligence/market-pulse'),
  methodology: () => request('/methodology'),

  // TAM / SAM / SOM market model
  marketModelStart: () => request('/intelligence/market-model/start', { method: 'POST' }),
  marketModelStatus: (jobId) => request(`/intelligence/market-model/status/${jobId}`),
  getMarketModel: () => request('/intelligence/market-model'),
  saveMarketModel: (inputs) => request('/intelligence/market-model', { method: 'PUT', body: { inputs } }),
  applyTam: (tamValue) => request('/intelligence/market-model', { method: 'PUT', body: { tam_value_usd: tamValue } }),
  reconcileBottomUp: () => request('/intelligence/market-model', { method: 'PUT', body: { reconcile_bottom_up: true } }),
  marketModelHistory: () => request('/intelligence/market-model/history'),
  factCheckStart: () => request('/intelligence/market-model/fact-check/start', { method: 'POST' }),
  factCheckStatus: (jobId) => request(`/intelligence/market-model/fact-check/status/${jobId}`),

  // Company deep dive — background job
  deepDiveStart: (company, url) => request('/company/deep-dive/start', { method: 'POST', body: { company, url } }),
  deepDiveStatus: (jobId) => request(`/company/deep-dive/status/${jobId}`),

  // Saved report history
  saveReport: (title, content) => request('/reports', { method: 'POST', body: { title, content } }),
  listReports: () => request('/reports'),
  getReport: (id) => request(`/reports/${id}`),
  getSharedReport: (token) => request(`/reports/shared/${token}`, { headers: {} }),
  reportDistributionDiff: (id) => request(`/reports/${id}/distribution-diff`),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),
  removeMember: (workspaceId, userId) =>
    request(`/auth/workspaces/${workspaceId}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  acceptInvite: (workspaceId) =>
    request('/auth/accept-invite', { method: 'POST', body: { workspaceId } }),
  getInviteInfo: (workspaceId) =>
    request(`/auth/invite-info/${workspaceId}`, { headers: {} }),

  // Feature labs
  getNextMoves: () => request('/features/next-moves'),
  generateNextMoves: () => request('/features/next-moves', { method: 'POST' }),
  listWinLoss: () => request('/features/win-loss'),
  createWinLoss: (payload) => request('/features/win-loss', { method: 'POST', body: payload }),
  getPositioningLab: () => request('/features/positioning-lab'),
  generatePositioningLab: (payload = {}) => request('/features/positioning-lab', { method: 'POST', body: payload }),
  simulatePricing: (payload) => request('/features/pricing-simulator', { method: 'POST', body: payload }),
  getFeatureGaps: () => request('/features/feature-gaps'),
  generateFeatureGaps: () => request('/features/feature-gaps', { method: 'POST' }),
  listEvidence: () => request('/features/evidence'),
  createEvidence: (payload) => request('/features/evidence', { method: 'POST', body: payload }),
  clearEvidence: () => request('/features/evidence', { method: 'DELETE' }),
  deleteEvidence: (id) => request(`/features/evidence/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listWarRoom: () => request('/features/war-room'),
  createWarRoomDeal: (payload) => request('/features/war-room', { method: 'POST', body: payload }),
  updateWarRoomDeal: (id, payload) => request(`/features/war-room/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  clearWarRoom: () => request('/features/war-room', { method: 'DELETE' }),
  deleteWarRoomDeal: (id) => request(`/features/war-room/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getMarketEntry: () => request('/features/market-entry'),
  generateMarketEntry: (payload) => request('/features/market-entry', { method: 'POST', body: payload }),
  getInvestorOnepager: () => request('/features/investor-onepager'),
  generateInvestorOnepager: () => request('/features/investor-onepager', { method: 'POST' }),
  listFeatureNotifications: () => request('/features/notifications'),
  markFeatureNotificationsRead: () => request('/features/notifications/mark-read', { method: 'POST' }),
  getFeatureUsage: () => request('/features/usage'),
  exportWorkspace: () => request('/features/export-workspace'),
  clearRetention: () => request('/features/retention', { method: 'DELETE' }),
  getDigestPrefs: () => request('/features/digest-prefs'),
  saveDigestPrefs: (payload) => request('/features/digest-prefs', { method: 'PUT', body: payload }),
  getCompetitorMeta: () => request('/features/competitor-meta'),
  saveCompetitorTags: (competitorId, tags) =>
    request('/features/competitor-meta/tags', { method: 'PUT', body: { competitorId, tags } }),
  saveCompetitorAlerts: (payload) => request('/features/competitor-meta/alerts', { method: 'PUT', body: payload }),
  compareCompanies: (companies) => request('/features/compare-companies', { method: 'POST', body: { companies } }),
  getImplications: (dossier) => request('/features/implications', { method: 'POST', body: { dossier } }),
  generateMarketScenarios: (base) => request('/features/market-scenarios', { method: 'POST', body: { base } }),
  getMarketScenarios: () => request('/features/market-scenarios'),
  exportFeatureReport: (snapshot, format = 'markdown') =>
    request('/features/export-report', { method: 'POST', body: { snapshot, format } }),

  // Push
  vapidKey: () => request('/push/vapid-public-key'),
  pushSubscribe: (subscription, alertTypes) =>
    request('/push/subscribe', { method: 'POST', body: { subscription, alertTypes } }),
  pushUnsubscribe: (endpoint) =>
    request('/push/unsubscribe', { method: 'DELETE', body: { endpoint } }),
};
