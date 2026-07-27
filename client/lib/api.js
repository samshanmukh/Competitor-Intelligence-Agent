import { getToken, getWorkspace, refreshAccessToken, ensureFreshSession, forceLogout } from './auth.js';

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
  // Proactively renew access token from httpOnly refresh cookie when near expiry.
  if (typeof window !== 'undefined' && !_retried) {
    await ensureFreshSession().catch(() => null);
  }

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

  /** Public landing demo — no auth. Long-running; needs NEXT_PUBLIC_API_BASE in prod. */
  demoPositioningMap: (pricingUrl) =>
    request('/demo/positioning-map', { method: 'POST', body: { pricingUrl } }),

  /** In-app analyst chat — Mira orchestrates; Pricing is auto-consulted when needed. */
  analystChat: (messages) =>
    request('/analyst/chat', { method: 'POST', body: { messages } }),

  /** Agent roster + online status (in-app ready + Band heartbeats). */
  analystAgents: () => request('/analyst/agents'),

  /**
   * Streaming analyst chat (SSE). Calls onEvent(event, data) for:
   * status | reasoning | token | done | error
   */
  analystChatStream: async (messages, onEvent, _retried = false) => {
    if (typeof window !== 'undefined' && !_retried) {
      await ensureFreshSession().catch(() => null);
    }

    const headers = getHeaders({ Accept: 'text/event-stream' });
    let res;
    try {
      res = await fetch(`${API_BASE}/api/analyst/chat?stream=1`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages }),
      });
    } catch {
      const err = new Error('Could not reach Mira AI. Check your connection and try again.');
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    if (res.status === 401 && !_retried) {
      const newToken = await refreshAccessToken();
      if (newToken) return api.analystChatStream(messages, onEvent, true);
      forceLogout();
      const err = new Error('Please sign in again.');
      err.code = 'UNAUTHENTICATED';
      throw err;
    }

    if (!res.ok) {
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
      const err = new Error(data?.error || `Request failed (${res.status})`);
      err.code = data?.code;
      err.status = res.status;
      throw err;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const err = new Error('Streaming not supported in this browser.');
      err.code = 'NO_STREAM';
      throw err;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let event = 'message';
        let dataLine = '';
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
        }
        if (!dataLine) continue;

        let data;
        try { data = JSON.parse(dataLine); } catch { continue; }

        if (event === 'error') {
          const err = new Error(data?.error || 'Chat failed');
          err.code = data?.code || 'ERROR';
          throw err;
        }
        if (event === 'done') donePayload = data;
        onEvent?.(event, data);
      }
    }

    return donePayload || { reply: '', consulted: ['Mira'], agentName: 'Mira' };
  },

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
  getAnalysisLatest: () => request('/intelligence/analysis-latest'),
  saveAnalysisLatest: (content) => request('/intelligence/analysis-latest', { method: 'PUT', body: { content } }),
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
  companyFinancials: (company) => request('/company/financials', { method: 'POST', body: { company } }),

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
  researchEvidence: (payload) => request('/features/evidence/research', { method: 'POST', body: payload }),
  saveEvidenceBatch: (items) => request('/features/evidence/save-batch', { method: 'POST', body: { items } }),
  clearEvidence: () => request('/features/evidence', { method: 'DELETE' }),
  deleteEvidence: (id) => request(`/features/evidence/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listWarRoom: () => request('/features/war-room'),
  createWarRoomDeal: (payload) => request('/features/war-room', { method: 'POST', body: payload }),
  updateWarRoomDeal: (id, payload) => request(`/features/war-room/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  generateWarRoomTalkTrack: (id) => request(`/features/war-room/${encodeURIComponent(id)}/talk-track`, { method: 'POST' }),
  clearWarRoom: () => request('/features/war-room', { method: 'DELETE' }),
  deleteWarRoomDeal: (id) => request(`/features/war-room/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getMarketEntry: () => request('/features/market-entry'),
  generateMarketEntry: (payload) => request('/features/market-entry', { method: 'POST', body: payload }),
  getInvestorOnepager: () => request('/features/investor-onepager'),
  generateInvestorOnepager: (payload = {}) => request('/features/investor-onepager', { method: 'POST', body: payload }),
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
