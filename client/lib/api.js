import { getWorkspace } from './auth.js';

function getHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const workspace = typeof window !== 'undefined' ? getWorkspace() : null;
  if (workspace?.id) headers['X-Workspace-Id'] = String(workspace.id);
  return headers;
}

// In dev, call the backend directly (NEXT_PUBLIC_API_BASE) to bypass the Next.js
// proxy's 30s timeout on long-running requests. In prod this is empty (same-origin).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const LOCAL_PRODUCT_KEY = 'mira_product';
const LOCAL_COMPETITORS_KEY = 'mira_competitors';
const LOCAL_ANALYSIS_KEY = 'mira_analysis_latest';
const LOCAL_REPORTS_KEY = 'mira_reports';

function readLocalProduct() {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(LOCAL_PRODUCT_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function getLocalProduct() {
  return { product: readLocalProduct() };
}

async function saveLocalProduct(payload) {
  const previous = readLocalProduct();
  const now = new Date().toISOString();
  const product = {
    ...previous,
    ...payload,
    id: previous?.id || 'local-product',
    created_at: previous?.created_at || now,
    updated_at: now,
  };
  if (typeof window !== 'undefined') localStorage.setItem(LOCAL_PRODUCT_KEY, JSON.stringify(product));
  return { product };
}

function readLocalCompetitors() {
  if (typeof window === 'undefined') return [];
  try {
    const value = localStorage.getItem(LOCAL_COMPETITORS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCompetitors(competitors) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_COMPETITORS_KEY, JSON.stringify(competitors));
  }
}

async function listLocalCompetitors(status) {
  const all = readLocalCompetitors();
  return { competitors: status ? all.filter((item) => item.status === status) : all };
}

async function addLocalCompetitors(incoming, status = 'approved') {
  const now = new Date().toISOString();
  const all = readLocalCompetitors();
  const added = [];
  for (const [index, candidate] of (Array.isArray(incoming) ? incoming : []).entries()) {
    const url = String(candidate?.pricing_url || candidate?.url || '').trim();
    if (!url) continue;
    const existingIndex = all.findIndex((item) => String(item.pricing_url).toLowerCase() === url.toLowerCase());
    const previous = existingIndex >= 0 ? all[existingIndex] : null;
    const competitor = {
      ...previous,
      ...candidate,
      id: previous?.id || `local-${Date.now()}-${index}`,
      pricing_url: url,
      status,
      created_at: previous?.created_at || now,
      updated_at: now,
      changeCount: previous?.changeCount || 0,
      hasSnapshot: Boolean(previous?.hasSnapshot),
    };
    if (existingIndex >= 0) all[existingIndex] = competitor;
    else all.push(competitor);
    added.push(competitor);
  }
  writeLocalCompetitors(all);
  return { added };
}

async function getLocalCompetitor(id) {
  return { competitor: readLocalCompetitors().find((item) => String(item.id) === String(id)) || null };
}

async function setLocalCompetitorStatus(id, status) {
  const all = readLocalCompetitors();
  const index = all.findIndex((item) => String(item.id) === String(id));
  if (index < 0) throw new Error('Competitor not found');
  all[index] = { ...all[index], status, updated_at: new Date().toISOString() };
  writeLocalCompetitors(all);
  return { competitor: all[index] };
}

async function deleteLocalCompetitor(id) {
  writeLocalCompetitors(readLocalCompetitors().filter((item) => String(item.id) !== String(id)));
  return { ok: true };
}

async function getLocalAnalysisLatest() {
  if (typeof window === 'undefined') return { result: null };
  try {
    const value = localStorage.getItem(LOCAL_ANALYSIS_KEY);
    return { result: value ? JSON.parse(value) : null };
  } catch { return { result: null }; }
}

async function saveLocalAnalysisLatest(content) {
  const result = { ...content, savedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') localStorage.setItem(LOCAL_ANALYSIS_KEY, JSON.stringify(result));
  return { result };
}

function readLocalReports() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_REPORTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function saveLocalReport(title, content) {
  const reports = readLocalReports();
  const report = { id: `local-${Date.now()}`, title, content, created_at: new Date().toISOString() };
  reports.unshift(report);
  if (typeof window !== 'undefined') localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(0, 25)));
  return { report };
}

async function listLocalReports() {
  return { reports: readLocalReports() };
}

async function getLocalReport(id) {
  return {
    report: readLocalReports().find((report) => String(report.id) === String(id)) || null,
  };
}

async function deleteLocalReport(id) {
  const reports = readLocalReports().filter((report) => String(report.id) !== String(id));
  if (typeof window !== 'undefined') localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
  return { ok: true };
}

async function exportLocalMarkdown(snapshot) {
  const names = (snapshot?.competitors || []).map((item) => item.name).filter(Boolean).join(', ');
  const lines = [
    '# Mira competitive analysis',
    '',
    names ? `Competitors: ${names}` : '',
    snapshot?.positioning ? `\n## Positioning\n\n${snapshot.positioning}` : '',
    snapshot?.take ? `\n## Analyst take\n\n${snapshot.take}` : '',
  ].filter(Boolean);
  return { markdown: lines.join('\n') };
}

async function request(path, { method = 'GET', body, headers: extraHeaders } = {}) {
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
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

  if (!res.ok) {
    const message = data?.error
      || (res.status === 503
        ? 'Mira AI is temporarily unavailable. Please try again shortly.'
        : `Request failed (${res.status})`);
    const err = new Error(message);
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Titles a caught request error. Feature-specific fallbacks ("Could not find
 * company info") are wrong when the backend itself is down — say so instead.
 */
export function errorTitle(err, fallback) {
  if (err?.code === 'NETWORK_ERROR') return 'Could not reach Mira AI';
  if (err?.code === 'DB_UNAVAILABLE') return 'Service unavailable';
  if (err?.status >= 500) return 'Something went wrong on our end';
  return fallback;
}

function originForUrl(value) {
  try { return new URL(value).origin; } catch { return value; }
}

async function runVercelCompetitorDemo(url, onEvent) {
  onEvent?.('status', { step: 'search', label: 'Looking up company…' });
  const identity = await request('/products/infer', { method: 'POST', body: { url } });
  const you = {
    name: identity?.name || new URL(url).hostname.replace(/^www\./, ''),
    website: originForUrl(identity?.source || url),
    pricing_url: url,
    statement: identity?.description || '',
    entry_price: null,
    value_score: 6,
    isYou: true,
  };

  onEvent?.('status', { step: 'competitors', label: 'Naming rivals…' });
  const discovery = await request('/discover', {
    method: 'POST',
    body: { description: identity?.description || you.name, productUrl: url },
  });
  const rivals = (discovery?.candidates || []).slice(0, 6).map((candidate, index) => ({
    ...candidate,
    statement: candidate.notes || '',
    entry_price: null,
    value_score: Math.max(4.5, 5.8 - index * 0.18),
  }));
  const market = `${you.name} competitive landscape`;
  onEvent?.('competitors', { market, you, rivals });

  const result = { market, you, rivals, partial: false };
  onEvent?.('done', result);
  return result;
}

export const api = {
  health: () => request('/health'),

  /** Public landing demo composed from the Vercel-native identity + discovery routes. */
  demoPositioningMap: (pricingUrl) => runVercelCompetitorDemo(pricingUrl),

  /** Fast public landing demo (JSON). Prefer demoCompetitorsFastStream for progressive UI. */
  demoCompetitorsFast: (url) => runVercelCompetitorDemo(url),

  /**
   * Fast public landing demo (SSE). Calls onEvent(event, data) for:
   * status | competitors | pricing | rival | done | error
   */
  demoCompetitorsFastStream: runVercelCompetitorDemo,

  /** In-app analyst chat, Mira orchestrates; Pricing is auto-consulted when needed. */
  analystChat: (messages) =>
    request('/analyst/chat', { method: 'POST', body: { messages } }),

  /** Agent roster + online status (in-app ready + Band heartbeats). */
  analystAgents: () => request('/analyst/agents'),

  /**
   * Streaming analyst chat (SSE). Calls onEvent(event, data) for:
   * status | reasoning | token | done | error
   */
  analystChatStream: async (messages, onEvent) => {
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

    if (!res.ok) {
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
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

  listCompetitors: listLocalCompetitors,
  addCompetitors: addLocalCompetitors,
  getCompetitor: getLocalCompetitor,
  setStatus: setLocalCompetitorStatus,
  deleteCompetitor: deleteLocalCompetitor,
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
  getWorkspace: (id) => request(`/auth/workspaces/${id}`, { headers: {} }),
  updateWorkspace: (id, updates) => request(`/auth/workspaces/${id}`, { method: 'PATCH', body: updates }),
  digestTest: (id, email) => request(`/auth/workspaces/${id}/digest-test`, { method: 'POST', body: { email } }),

  // Product
  getProduct: getLocalProduct,
  saveProduct: saveLocalProduct,
  inferProduct: (url) => request('/products/infer', { method: 'POST', body: { url } }),
  fullAnalysis: (product, competitors) => request('/analysis', { method: 'POST', body: { product, competitors } }),

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
  getAnalysisLatest: getLocalAnalysisLatest,
  saveAnalysisLatest: saveLocalAnalysisLatest,
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

  // You.com-powered company and market research
  deepDive: (company, url) => request('/company/deep-dive', { method: 'POST', body: { company, url } }),
  companyFinancials: (company, url) => request('/company/deep-dive', {
    method: 'POST',
    body: { action: 'financials', company, url },
  }),

  // Saved report history
  saveReport: saveLocalReport,
  listReports: listLocalReports,
  getReport: getLocalReport,
  getSharedReport: (token) => request(`/reports/shared/${token}`, { headers: {} }),
  reportDistributionDiff: (id) => request(`/reports/${id}/distribution-diff`),
  deleteReport: deleteLocalReport,
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
  compareCompanies: async (companies) => {
    const { product } = await getLocalProduct();
    return request('/company/deep-dive', { method: 'POST', body: { action: 'compare', companies, product } });
  },
  getImplications: async (dossier) => {
    const { product } = await getLocalProduct();
    return request('/company/deep-dive', { method: 'POST', body: { action: 'implications', dossier, product } });
  },
  generateMarketScenarios: (base) => request('/features/market-scenarios', { method: 'POST', body: { base } }),
  getMarketScenarios: () => request('/features/market-scenarios'),
  exportFeatureReport: (snapshot) => exportLocalMarkdown(snapshot),

  // Push
  vapidKey: () => request('/push/vapid-public-key'),
  pushSubscribe: (subscription, alertTypes) =>
    request('/push/subscribe', { method: 'POST', body: { subscription, alertTypes } }),
  pushUnsubscribe: (endpoint) =>
    request('/push/unsubscribe', { method: 'DELETE', body: { endpoint } }),
};
