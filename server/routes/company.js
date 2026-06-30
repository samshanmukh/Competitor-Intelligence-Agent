// Company Deep Dive — a standalone single-company dossier: overview, financials,
// market size/growth, web traffic (Apify), and reviews + AI analysis.
//
// Because some sections are slow (deep finance research ~2-3 min, SimilarWeb
// traffic can take several minutes), the full dossier runs as a durable
// BACKGROUND JOB: start it, navigate away, get a push notification + cached
// result when it's done.
import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { complete, completeJSON } from '../services/ai.js';
import { research, financeResearch } from '../services/youcom.js';
import { getWebsiteTraffic, crawlContent, apifyConfigured } from '../services/apify.js';
import { createJob, getJob, completeJob, failJob } from '../services/jobs.js';
import { sendPushToWorkspace } from '../services/push.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

function flatten(payload) {
  const parts = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) parts.push(v.trim()); };
  if (payload?.output) {
    push(payload.output.content);
    for (const s of payload.output.sources || []) push([s.title, s.url, (s.snippets || []).join(' ')].filter(Boolean).join(' — '));
  }
  push(payload?.answer); push(payload?.summary);
  for (const b of [payload?.results, payload?.sources, payload?.web_results]) {
    if (Array.isArray(b)) for (const i of b) push([i.title || i.name, i.url || i.link, i.snippet || i.description].filter(Boolean).join(' — '));
  }
  return parts.join('\n');
}

/* ───────────────────────── Section functions ───────────────────────── */
async function getOverview(company, url) {
  // Pull web research + (if a URL is given) the company's own site content via
  // Apify, so the overview is grounded in first-hand copy, not just summaries.
  const [payload, siteContent] = await Promise.all([
    research(`Company overview of ${company}${url ? ` (${url})` : ''}: what they do, founded year, headquarters, employee count, business model, products, and notable recent news.`),
    url && apifyConfigured() ? crawlContent(url).catch(() => null) : Promise.resolve(null),
  ]);
  const text = `${siteContent ? `THEIR WEBSITE:\n${siteContent.slice(0, 4000)}\n\n` : ''}${flatten(payload)}`.slice(0, 12000);
  const overview = await completeJSON({
    system: 'You extract structured company facts from research text. Use only facts present. Return ONLY valid JSON.',
    user: `From this research about "${company}", extract:
{ "summary": "2-3 sentence description", "founded": "year or null", "headquarters": "city, country or null", "employees": "approx headcount or null", "business_model": "or null", "products": ["key products"], "recent_news": ["1-3 notable developments"] }

RESEARCH:
${text}`,
    maxTokens: 800,
  });
  const sources = (payload?.output?.sources || []).slice(0, 6).map((s) => ({ title: s.title, url: s.url }));
  return overview ? { ...overview, sources } : null;
}

async function getFinancials(company) {
  const input = `For the company "${company}": estimate total funding raised, latest valuation, annual revenue, key investors, and employee count. Then estimate the size of its overall market for the last 5 years (a number per year if possible) and the market's annual growth rate (CAGR). Provide concrete numbers and cite sources.`;
  const payload = await financeResearch(input, 'deep');
  const text = flatten(payload).slice(0, 12000);
  if (!text) return { financials: null, market: null };
  const structured = await completeJSON({
    system: 'You convert financial research into structured JSON for charts. Use only numbers present. Return ONLY valid JSON.',
    user: `From the research about "${company}", extract:
{ "financials": { "total_funding": "or null", "valuation": "or null", "revenue": "or null", "investors": ["notable investors"], "employees": "or null" },
  "market": { "size_current": "or null", "cagr": "or null", "history": [ { "year": 2021, "size_usd_millions": 1800 } ], "summary": "2-3 sentence overview" } }

RESEARCH:
${text}`,
    maxTokens: 1400,
  });
  const sources = (payload?.output?.sources || []).slice(0, 8).map((s) => ({ title: s.title, url: s.url }));
  return {
    financials: structured?.financials || null,
    market: structured?.market ? { ...structured.market, sources } : null,
  };
}

async function getTraffic(company, url) {
  if (!apifyConfigured()) return { traffic: null, configured: false };
  try {
    const traffic = await getWebsiteTraffic(url || company);
    return { traffic, configured: true, blocked: !traffic };
  } catch (err) {
    // PROXY_BLOCKED = Apify residential proxy refused (free plan); the UI uses
    // `blocked` to show the "upgrade your Apify plan" explainer.
    const blocked = err.code === 'PROXY_BLOCKED';
    return { traffic: null, configured: true, blocked, error: err.message };
  }
}

async function getReviews(company) {
  const payload = await research(`${company} customer reviews, ratings, pros and cons on G2, Capterra, Trustpilot.`);
  const text = flatten(payload).slice(0, 7000);
  if (!text) return null;
  return await completeJSON({
    system: 'You summarize software reviews into structured sentiment + a short analyst take. Return ONLY valid JSON.',
    user: `Summarize customer review sentiment for "${company}".
Return: { "rating": number|null, "sentiment": "positive"|"mixed"|"negative", "pros": ["..."], "cons": ["..."], "summary": "one-sentence take", "ai_analysis": "2-3 sentences on what this means for evaluating/competing with them" }

RESEARCH:
${text}`,
    maxTokens: 800,
  });
}

/* ───────────────────────── Individual endpoints (still usable) ───────────────────────── */
router.post('/overview', wrap(async (req, res) => {
  const { company, url } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company required' });
  const overview = await getOverview(company, url);
  res.json({ overview, sources: overview?.sources || [] });
}));

router.post('/financials', wrap(async (req, res) => {
  const { company } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company required' });
  res.json(await getFinancials(company));
}));

router.post('/traffic', wrap(async (req, res) => {
  const { company, url } = req.body || {};
  if (!company && !url) return res.status(400).json({ error: 'company or url required' });
  res.json(await getTraffic(company, url));
}));

router.post('/reviews', wrap(async (req, res) => {
  const { company } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company required' });
  res.json({ reviews: await getReviews(company) });
}));

/* ───────────────────────── Background deep-dive job ───────────────────────── */
async function runDeepDive(company, url) {
  // Run every section independently; one slow/failed section never blocks the rest.
  const [overview, fin, traffic, reviews] = await Promise.allSettled([
    getOverview(company, url),
    getFinancials(company),
    getTraffic(company, url),
    getReviews(company),
  ]);
  const finVal = fin.status === 'fulfilled' ? fin.value : { financials: null, market: null };
  const trafVal = traffic.status === 'fulfilled' ? traffic.value : { traffic: null, configured: apifyConfigured() };
  return {
    company,
    url: url || null,
    overview: overview.status === 'fulfilled' ? overview.value : null,
    financials: finVal.financials,
    market: finVal.market,
    traffic: trafVal.traffic,
    trafficConfigured: trafVal.configured,
    trafficBlocked: trafVal.blocked || false,
    trafficError: trafVal.error || null,
    reviews: reviews.status === 'fulfilled' ? reviews.value : null,
    generatedAt: new Date().toISOString(),
  };
}

// Start a background deep-dive; returns a jobId immediately.
router.post('/deep-dive/start', resolveWorkspace, wrap(async (req, res) => {
  const { company, url } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company required' });
  const workspaceId = req.workspaceId;
  const jobId = await createJob({ workspaceId, userId: req.user.id, type: 'deep-dive' });

  runDeepDive(company, url)
    .then(async (dossier) => {
      await completeJob(jobId, { dossier });
      sendPushToWorkspace(workspaceId, {
        title: `Deep dive ready: ${company}`,
        body: 'Your company dossier has finished — open it to view.',
        url: '/company',
        tag: `deepdive-${jobId}`,
      }, 'any').catch(() => {});
    })
    .catch((err) => {
      console.error(`[deep-dive ${jobId}] failed:`, err.message);
      failJob(jobId, err.message);
    });

  res.json({ jobId });
}));

router.get('/deep-dive/status/:jobId', wrap(async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired', code: 'JOB_NOT_FOUND' });
  res.json({ status: job.status, result: job.result, error: job.error });
}));

export default router;
