// Company Deep Dive — a standalone single-company dossier: overview, financials,
// market size/growth, web traffic (You.com research), and reviews + AI analysis.
//
// Because some sections are slow (deep finance research ~2-3 min), the full
// dossier runs as a durable BACKGROUND JOB: start it, navigate away, get a
// push notification + cached result when it's done.
import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { completeJSON } from '../services/ai.js';
import { research, financeResearch, fetchContents } from '../services/youcom.js';
import { createJob, getJob, completeJob, failJob } from '../services/jobs.js';
import { sendPushToWorkspace } from '../services/push.js';
import { makeAttribution, mergeAttributions } from '../services/attribution.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth, resolveWorkspace);

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

function normalizeUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/* ───────────────────────── Section functions ───────────────────────── */
async function getOverview(company, url) {
  const pageUrl = normalizeUrl(url);
  const [payload, siteMap] = await Promise.all([
    research(`Company overview of ${company}${url ? ` (${url})` : ''}: what they do, founded year, headquarters, employee count, business model, products, and notable recent news.`),
    pageUrl
      ? fetchContents([pageUrl]).catch(() => ({}))
      : Promise.resolve({}),
  ]);
  const siteContent = pageUrl ? (siteMap[pageUrl]?.markdown || Object.values(siteMap)[0]?.markdown || null) : null;
  const text = `${siteContent ? `THEIR WEBSITE:\n${siteContent.slice(0, 4000)}\n\n` : ''}${flatten(payload)}`.slice(0, 12000);
  const overview = await completeJSON({
    system: 'You extract structured company facts from research text. Use only facts present. Return ONLY valid JSON.',
    user: `From this research about "${company}", extract:
{ "summary": "2-3 sentence description", "founded": "year or null", "headquarters": "city, country or null", "employees": "approx headcount or null", "business_model": "or null", "products": ["key products"], "recent_news": ["1-3 notable developments"] }

RESEARCH:
${text}`,
    maxTokens: 800,
  });
  const researchAttr = makeAttribution('youcom-research', payload, { limit: 6 });
  const contentsAttr = siteContent
    ? makeAttribution('youcom-contents', pageUrl ? [{ title: company, url: pageUrl }] : [], { limit: 1 })
    : null;
  const attribution = mergeAttributions([researchAttr, contentsAttr], { limit: 8 });
  return overview
    ? {
        ...overview,
        sources: attribution.sources.length ? attribution.sources : researchAttr.sources,
        attribution: {
          ...researchAttr,
          skills: attribution.skills,
          sources: attribution.sources.length ? attribution.sources : researchAttr.sources,
        },
        skill: researchAttr.skill,
        skillLabel: researchAttr.skillLabel,
      }
    : null;
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
  const attribution = makeAttribution('youcom-finance', payload, { limit: 8 });
  return {
    financials: structured?.financials
      ? { ...structured.financials, attribution, sources: attribution.sources, skill: attribution.skill, skillLabel: attribution.skillLabel }
      : null,
    market: structured?.market
      ? { ...structured.market, sources: attribution.sources, attribution, skill: attribution.skill, skillLabel: attribution.skillLabel }
      : null,
  };
}

async function getTraffic(company, url) {
  const domain = String(url || company || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '') || company;
  try {
    const payload = await research(
      `Website traffic for ${company}${url ? ` (domain ${url})` : ''}: estimate monthly visits, global rank, bounce rate, pages per visit, visit duration, and traffic source mix if known. Cite sources.`,
      { effort: 'lite' }
    );
    const text = flatten(payload).slice(0, 8000);
    if (!text) return { traffic: null, configured: true };
    const structured = await completeJSON({
      system: 'Extract website traffic estimates from research. Use only numbers present. Return ONLY valid JSON.',
      user: `From this research about "${company}" (${domain}), extract:
{ "total_visits": number|null, "global_rank": number|null, "bounce_rate": number|null, "pages_per_visit": number|null, "avg_visit_duration": "string or null", "category": "string or null", "history": [{ "date": "YYYY-MM", "visits": number }], "sources": [{ "channel": string, "share": number }], "topCountries": [{ "country": string, "share": number }], "summary": "one line or null" }
share values are 0–1 fractions when known. history max 12 months.

RESEARCH:
${text}`,
      maxTokens: 900,
    });
    if (!structured) return { traffic: null, configured: true };
    const attribution = makeAttribution('youcom-research', payload, { limit: 6 });
    return {
      traffic: {
        domain,
        ...structured,
        // Keep channel mix under trafficChannels; citations live in attribution.
        trafficChannels: structured.sources || [],
        sources: attribution.sources,
        attribution,
        skill: attribution.skill,
        skillLabel: attribution.skillLabel,
        source: 'youcom-research',
      },
      configured: true,
    };
  } catch (err) {
    return { traffic: null, configured: true, error: err.message };
  }
}

async function getReviews(company) {
  const payload = await research(`${company} customer reviews, ratings, pros and cons on G2, Capterra, Trustpilot.`);
  const text = flatten(payload).slice(0, 7000);
  if (!text) return null;
  const summary = await completeJSON({
    system: 'You summarize software reviews into structured sentiment + a short analyst take. Return ONLY valid JSON.',
    user: `Summarize customer review sentiment for "${company}".
Return: { "rating": number|null, "sentiment": "positive"|"mixed"|"negative", "pros": ["..."], "cons": ["..."], "summary": "one-sentence take", "ai_analysis": "2-3 sentences on what this means for evaluating/competing with them" }

RESEARCH:
${text}`,
    maxTokens: 800,
  });
  if (!summary) return null;
  const attribution = makeAttribution('youcom-research', payload, { limit: 6 });
  return {
    ...summary,
    attribution,
    sources: attribution.sources,
    skill: attribution.skill,
    skillLabel: attribution.skillLabel,
  };
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
  const trafVal = traffic.status === 'fulfilled' ? traffic.value : { traffic: null, configured: true };
  return {
    company,
    url: url || null,
    overview: overview.status === 'fulfilled' ? overview.value : null,
    financials: finVal.financials,
    market: finVal.market,
    traffic: trafVal.traffic,
    trafficConfigured: trafVal.configured !== false,
    trafficBlocked: false,
    trafficError: trafVal.error || null,
    reviews: reviews.status === 'fulfilled' ? reviews.value : null,
    generatedAt: new Date().toISOString(),
  };
}

// Start a background deep-dive; returns a jobId immediately.
router.post('/deep-dive/start', wrap(async (req, res) => {
  const { company, url } = req.body || {};
  if (!company?.trim()) return res.status(400).json({ error: 'company required' });
  const jobId = await createJob({ workspaceId: req.workspaceId, userId: req.user.id, type: 'deep-dive' });

  const workspaceId = req.workspaceId;
  runDeepDive(company.trim(), url?.trim() || null)
    .then(async (dossier) => {
      await completeJob(jobId, { dossier });
      sendPushToWorkspace(workspaceId, {
        title: `Deep dive ready: ${company.trim()}`,
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
  if (!job || String(job.workspace_id) !== String(req.workspaceId)) {
    return res.status(404).json({ error: 'Job not found or expired', code: 'JOB_NOT_FOUND' });
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

export default router;
