export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* handled by status */ }
    if (!response.ok) throw new Error(data?.error || data?.message || `Provider failed (${response.status})`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function sourcesFromResearch(payload) {
  return (Array.isArray(payload?.output?.sources) ? payload.output.sources : []).map((source) => ({
    title: String(source?.title || '').trim(),
    url: String(source?.url || '').trim(),
    snippet: String(
      Array.isArray(source?.snippets) ? source.snippets.join(' ') : source?.snippet || ''
    ).trim(),
  })).filter((source) => /^https?:\/\//i.test(source.url)).slice(0, 25);
}

function parseJson(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function sourceObjects(urls, evidence) {
  const allowed = new Map(evidence.map((source) => [source.url, source]));
  return (Array.isArray(urls) ? urls : []).map((url) => allowed.get(url)).filter(Boolean).slice(0, 3);
}

function numberOrNull(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
}

function evidenceForCompany(company, evidence) {
  let host = '';
  try { host = new URL(company.website || company.pricing_url || '').hostname.replace(/^www\./, ''); } catch { /* optional URL */ }
  const name = String(company.name || '').toLowerCase();
  return evidence.filter((source) => {
    const haystack = `${source.title} ${source.url} ${source.snippet}`.toLowerCase();
    return (host && haystack.includes(host)) || (name && haystack.includes(name));
  }).slice(0, 3);
}

function hasMeaningfulStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') return false;
  if (String(strategy.icp || '').trim() || String(strategy.business_model || '').trim()) return true;
  const swot = strategy.swot || {};
  if (['strengths', 'weaknesses', 'opportunities', 'threats'].some((key) => Array.isArray(swot[key]) && swot[key].some(Boolean))) return true;
  return Array.isArray(strategy.positioning) && strategy.positioning.some((row) => (
    String(row?.positioning || '').trim()
    || String(row?.target_audience || '').trim()
    || String(row?.messaging_angle || '').trim()
  ));
}

function compactText(value, maxLength = 420) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text || null;
  const shortened = text.slice(0, maxLength);
  const boundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, boundary > maxLength * 0.7 ? boundary : maxLength).trim()}…`;
}

function normalizeReport(raw, inputProduct, inputCompetitors, evidence) {
  const report = raw && typeof raw === 'object' ? raw : {};
  const competitors = inputCompetitors.map((item) => {
    const scored = (report.competitors || []).find((row) => String(row?.name).toLowerCase() === String(item.name).toLowerCase()) || {};
    return {
      id: item.id,
      name: item.name,
      value_score: numberOrNull(scored.value_score, 1, 10),
      value_analysis: String(scored.value_analysis || '').trim() || null,
    };
  });
  const reviewRows = Array.isArray(report.reviews) ? report.reviews : [];
  const reviews = inputCompetitors.map((original) => {
    const row = reviewRows.find((item) => String(item?.name || '').toLowerCase() === String(original.name).toLowerCase()) || {};
    const selectedSources = sourceObjects(row?.source_urls, evidence);
    const sources = selectedSources.length ? selectedSources : evidenceForCompany(original, evidence);
    return {
      id: original.id,
      name: original.name,
      rating: numberOrNull(row?.rating, 0, 5),
      sentiment: ['positive', 'mixed', 'negative'].includes(row?.sentiment) ? row.sentiment : null,
      summary: compactText(row?.summary || sources[0]?.snippet),
      pros: Array.isArray(row?.pros) ? row.pros.filter(Boolean).slice(0, 4) : [],
      cons: Array.isArray(row?.cons) ? row.cons.filter(Boolean).slice(0, 4) : [],
      sources,
      skill: 'you-research',
      skillLabel: 'You.com Research',
    };
  });

  return {
    product: {
      ...inputProduct,
      ...(report.product || {}),
      name: inputProduct.name,
      pricing_url: inputProduct.pricing_url,
    },
    matrix: {
      productName: inputProduct.name,
      features: Array.isArray(report.matrix?.features) ? report.matrix.features.slice(0, 10) : [],
      competitors: Array.isArray(report.matrix?.competitors) ? report.matrix.competitors : [],
    },
    positioning: String(report.positioning || '').trim() || null,
    reviews,
    strategy: hasMeaningfulStrategy(report.strategy) ? report.strategy : null,
    take: String(report.take || '').trim() || null,
    competitors,
    sources: evidence,
    providers: { youcom: true },
  };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const product = body?.product;
  const competitors = Array.isArray(body?.competitors) ? body.competitors.slice(0, 8) : [];
  if (!product?.name || !competitors.length) {
    return Response.json({ error: 'Add a product and at least one competitor first.' }, { status: 400 });
  }
  if (!process.env.YOUCOM_API_KEY) {
    return Response.json({ error: 'Analysis is temporarily unavailable.', code: 'MISSING_KEY' }, { status: 503 });
  }

  const companies = [product, ...competitors].map((item) => ({
    name: item.name,
    website: item.website || null,
    pricing_url: item.pricing_url || null,
    description: item.description || item.notes || null,
  }));
  const prompt = `Research and create a concise competitive analysis for these companies:\n${JSON.stringify(companies)}\n\nReturn only valid JSON with this exact top-level shape:
{"product":{"icp":"","business_model":"","value_score":1,"value_analysis":"","tiers":[{"name":"","price_monthly":null,"features":[]}]},"competitors":[{"name":"","value_score":1,"value_analysis":""}],"matrix":{"features":[""],"competitors":[{"name":"","pricing_url":"","pricing_sources":[{"url":"","label":"Source"}],"tiers":[{"name":"","price_monthly":null,"features":["included|limited|absent|unverified"]}]}]},"positioning":"markdown narrative","reviews":[{"name":"","rating":null,"sentiment":"positive|mixed|negative","summary":"","pros":[""],"cons":[""],"source_urls":[""]}],"strategy":{"icp":"","business_model":"","swot":{"strengths":[""],"weaknesses":[""],"opportunities":[""],"threats":[""]},"positioning":[{"name":"","positioning":"","target_audience":"","messaging_angle":""}]},"take":"markdown analyst recommendation"}

Rules: use current web research and primary/credible review sources. Include every supplied company in matrix.competitors and every rival (but not the user's product) in reviews/competitors. Feature arrays must align with matrix.features. Put complete https URLs in source_urls and pricing_sources. Never invent ratings or prices; use null when not evidenced. Review summaries must be described as themes, not fabricated quotes. Every narrative field must be useful and non-empty; clearly label analytical inferences when evidence is incomplete. Include 5-8 relevant matrix features, concrete SWOT items, positioning for every company, and a decisive analyst take.`;

  try {
    const data = await fetchJson(
      'https://api.you.com/v1/research',
      {
        method: 'POST',
        headers: { 'X-API-Key': process.env.YOUCOM_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: prompt,
          research_effort: 'lite',
        }),
      },
      42000
    );
    const parsed = parseJson(data?.output?.content);
    if (!parsed) throw new Error('The analysis response was not valid JSON.');
    return Response.json({ report: normalizeReport(parsed, product, competitors, sourcesFromResearch(data)) });
  } catch (error) {
    return Response.json({ error: error?.name === 'AbortError' ? 'You.com research timed out. Please try again.' : 'You.com could not generate the analysis right now.' }, { status: error?.name === 'AbortError' ? 504 : 502 });
  }
}
