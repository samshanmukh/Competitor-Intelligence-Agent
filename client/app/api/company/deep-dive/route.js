export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

async function fetchJson(url, options, timeoutMs = 42000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* status handling below */ }
    if (!response.ok) throw new Error(data?.error || data?.message || data?.detail || `Provider failed (${response.status})`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function researchSources(payload) {
  return (Array.isArray(payload?.output?.sources) ? payload.output.sources : []).map((source) => ({
    title: String(source?.title || '').trim(),
    url: String(source?.url || '').trim(),
    snippet: String(Array.isArray(source?.snippets) ? source.snippets.join(' ') : source?.snippet || '')
      .replace(/\s+/g, ' ').trim().slice(0, 500),
  })).filter((source) => /^https?:\/\//i.test(source.url)).slice(0, 20);
}

function attribution(sources) {
  return {
    engine: 'youcom-research',
    skill: 'you-research',
    skillLabel: 'You.com Research',
    sourceCount: sources.length,
    sources,
  };
}

function textOrNull(value, max = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function stringList(value, limit = 8) {
  return Array.isArray(value) ? value.map((item) => textOrNull(item, 300)).filter(Boolean).slice(0, limit) : [];
}

function numberOrNull(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
}

function fractionOrNull(value) {
  const number = numberOrNull(value, 0, 100);
  if (number === null) return null;
  return number > 1 ? number / 100 : number;
}

function attachSources(section, sources) {
  if (!section || typeof section !== 'object') return null;
  const sourceAttribution = attribution(sources);
  return {
    ...section,
    sources,
    attribution: sourceAttribution,
    skill: sourceAttribution.skill,
    skillLabel: sourceAttribution.skillLabel,
  };
}

function normalizeDossier(raw, company, url, sources) {
  const overviewRaw = raw?.overview || {};
  const financialsRaw = raw?.financials || {};
  const marketRaw = raw?.market || {};
  const trafficRaw = raw?.traffic || {};
  const reviewsRaw = raw?.reviews || {};
  const trafficChannels = (Array.isArray(trafficRaw.traffic_channels) ? trafficRaw.traffic_channels : [])
    .map((row) => ({ channel: textOrNull(row?.channel, 80), share: fractionOrNull(row?.share) }))
    .filter((row) => row.channel && row.share !== null)
    .slice(0, 8);

  return {
    company,
    url: url || null,
    overview: attachSources({
      summary: textOrNull(overviewRaw.summary, 1000),
      founded: textOrNull(overviewRaw.founded, 60),
      headquarters: textOrNull(overviewRaw.headquarters, 120),
      employees: textOrNull(overviewRaw.employees, 80),
      business_model: textOrNull(overviewRaw.business_model, 180),
      products: stringList(overviewRaw.products, 10),
      recent_news: stringList(overviewRaw.recent_news, 5),
    }, sources),
    financials: attachSources({
      total_funding: textOrNull(financialsRaw.total_funding, 100),
      valuation: textOrNull(financialsRaw.valuation, 100),
      revenue: textOrNull(financialsRaw.revenue, 100),
      investors: stringList(financialsRaw.investors, 10),
      employees: textOrNull(financialsRaw.employees, 80),
    }, sources),
    market: attachSources({
      category: textOrNull(marketRaw.category, 160),
      tam: textOrNull(marketRaw.tam, 120),
      sam: textOrNull(marketRaw.sam, 120),
      som: textOrNull(marketRaw.som, 120),
      size_current: textOrNull(marketRaw.size_current, 120),
      cagr: textOrNull(marketRaw.cagr, 80),
      history: (Array.isArray(marketRaw.history) ? marketRaw.history : []).map((row) => ({
        year: numberOrNull(row?.year, 1900, 2200),
        size_usd_millions: numberOrNull(row?.size_usd_millions, 0),
      })).filter((row) => row.year && row.size_usd_millions !== null).slice(-10),
      summary: textOrNull(marketRaw.summary, 1000),
      methodology: textOrNull(marketRaw.methodology, 1000),
      assumptions: stringList(marketRaw.assumptions, 8),
    }, sources),
    traffic: attachSources({
      domain: textOrNull(trafficRaw.domain, 160),
      total_visits: numberOrNull(trafficRaw.total_visits, 0),
      global_rank: numberOrNull(trafficRaw.global_rank, 1),
      bounce_rate: fractionOrNull(trafficRaw.bounce_rate),
      pages_per_visit: numberOrNull(trafficRaw.pages_per_visit, 0, 1000),
      avg_visit_duration: textOrNull(trafficRaw.avg_visit_duration, 80),
      category: textOrNull(trafficRaw.category, 120),
      history: (Array.isArray(trafficRaw.history) ? trafficRaw.history : []).map((row) => ({
        date: textOrNull(row?.date, 20),
        visits: numberOrNull(row?.visits, 0),
      })).filter((row) => row.date && row.visits !== null).slice(-12),
      trafficChannels,
      topCountries: (Array.isArray(trafficRaw.top_countries) ? trafficRaw.top_countries : []).map((row) => ({
        country: textOrNull(row?.country, 100),
        share: fractionOrNull(row?.share),
      })).filter((row) => row.country && row.share !== null).slice(0, 8),
      summary: textOrNull(trafficRaw.summary, 500),
    }, sources),
    trafficConfigured: true,
    trafficBlocked: false,
    trafficError: null,
    reviews: attachSources({
      rating: numberOrNull(reviewsRaw.rating, 0, 5),
      sentiment: ['positive', 'mixed', 'negative'].includes(reviewsRaw.sentiment) ? reviewsRaw.sentiment : null,
      pros: stringList(reviewsRaw.pros, 6),
      cons: stringList(reviewsRaw.cons, 6),
      summary: textOrNull(reviewsRaw.summary, 500),
      ai_analysis: textOrNull(reviewsRaw.ai_analysis, 900),
    }, sources),
    sources,
    provider: 'youcom-research',
    generatedAt: new Date().toISOString(),
  };
}

function dossierPrompt(company, url) {
  return `Research a detailed current company dossier for ${company}${url ? ` (${url})` : ''}. Use credible sources and distinguish reported facts from estimates. Return only valid JSON with this exact shape:
{"overview":{"summary":"","founded":null,"headquarters":null,"employees":null,"business_model":null,"products":[""],"recent_news":[""]},"financials":{"total_funding":null,"valuation":null,"revenue":null,"investors":[""],"employees":null},"market":{"category":null,"tam":null,"sam":null,"som":null,"size_current":null,"cagr":null,"history":[{"year":2025,"size_usd_millions":null}],"summary":"","methodology":"","assumptions":[""]},"traffic":{"domain":null,"total_visits":null,"global_rank":null,"bounce_rate":null,"pages_per_visit":null,"avg_visit_duration":null,"category":null,"history":[{"date":"YYYY-MM","visits":null}],"traffic_channels":[{"channel":"Direct","share":null}],"top_countries":[{"country":"","share":null}],"summary":""},"reviews":{"rating":null,"sentiment":"positive|mixed|negative","pros":[""],"cons":[""],"summary":"","ai_analysis":""}}

Rules: never invent figures. Use null when a funding, valuation, revenue, traffic, rating, market-size, or growth number is not supported. For the market model, identify the specific market category, provide sourced TAM, SAM, and SOM as labeled strings where defensible, and explain the narrowing methodology and assumptions; use null instead of unsupported precision. Traffic and financial figures may be labeled as estimates in their string fields. Market history numbers must be USD millions. Shares must be 0-1 fractions. Review summaries describe themes, never fabricated quotes. Keep recent news specific and dated where possible.`;
}

function financialsPrompt(company) {
  return `Research current financial and market information for ${company}. Return only valid JSON:
{"financials":{"total_funding":null,"valuation":null,"revenue":null,"investors":[""],"employees":null},"market":{"category":null,"tam":null,"sam":null,"som":null,"size_current":null,"cagr":null,"history":[{"year":2025,"size_usd_millions":null}],"summary":"","methodology":"","assumptions":[""]}}
Never invent figures. Use null for unsupported numbers and clearly label estimates. Explain how TAM narrows to SAM and SOM.`;
}

function comparePrompt(companies, product) {
  return `Research and compare these companies for a founder: ${companies.join(', ')}.${product?.name ? ` The founder's product is ${product.name}: ${product.description || ''}` : ''}
Return only valid JSON:
{"summary":"","dimensions":[{"name":"","scores":{},"notes":""}],"implicationsForUs":[""],"recommendation":""}
Include 4-6 useful comparison dimensions. Scores are 1-10 and the scores object uses each supplied company name as a key. Base claims on current research and label inference.`;
}

function implicationsPrompt(dossier, product) {
  return `Given this researched company dossier and the founder's product, explain the competitive implications.
DOSSIER: ${JSON.stringify(dossier).slice(0, 18000)}
PRODUCT: ${JSON.stringify(product || {}).slice(0, 3000)}
Return only valid JSON:
{"summary":"","threats":[""],"opportunities":[""],"actions":[""]}
Keep it specific, decision-oriented, and grounded in the dossier.`;
}

async function runResearch(input) {
  const data = await fetchJson('https://api.you.com/v1/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.YOUCOM_API_KEY },
    body: JSON.stringify({ input, research_effort: 'lite' }),
  });
  const result = parseJson(data?.output?.content);
  if (!result) throw new Error('You.com returned an unreadable research result.');
  return { result, sources: researchSources(data) };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  if (!process.env.YOUCOM_API_KEY) {
    return Response.json({ error: 'You.com research is not configured.', code: 'MISSING_KEY' }, { status: 503 });
  }

  const action = String(body?.action || 'dossier');
  try {
    if (action === 'compare') {
      const companies = Array.isArray(body?.companies)
        ? body.companies.map((item) => textOrNull(item, 100)).filter(Boolean).slice(0, 4)
        : [];
      if (companies.length < 2) return Response.json({ error: 'Provide at least two companies.' }, { status: 400 });
      const researched = await runResearch(comparePrompt(companies, body?.product));
      return Response.json({ result: researched.result, sources: researched.sources, provider: 'youcom-research' });
    }

    if (action === 'implications') {
      if (!body?.dossier) return Response.json({ error: 'A dossier is required.' }, { status: 400 });
      const researched = await runResearch(implicationsPrompt(body.dossier, body?.product));
      return Response.json({ result: researched.result, sources: researched.sources, provider: 'youcom-research' });
    }

    const company = textOrNull(body?.company, 120);
    const url = textOrNull(body?.url, 500);
    if (!company) return Response.json({ error: 'Enter a company name.' }, { status: 400 });
    if (!url) return Response.json({ error: 'Enter the company website or domain.' }, { status: 400 });

    if (action === 'financials') {
      const researched = await runResearch(financialsPrompt(company));
      const dossier = normalizeDossier(researched.result, company, url, researched.sources);
      return Response.json({ financials: dossier.financials, market: dossier.market, provider: dossier.provider });
    }

    const researched = await runResearch(dossierPrompt(company, url));
    return Response.json({ dossier: normalizeDossier(researched.result, company, url, researched.sources) });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return Response.json(
      { error: timedOut ? 'You.com research timed out. Please try again.' : 'You.com could not complete this research right now.' },
      { status: timedOut ? 504 : 502 }
    );
  }
}
