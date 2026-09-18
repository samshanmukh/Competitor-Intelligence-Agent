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
    try { data = text ? JSON.parse(text) : {}; } catch { /* handled by status below */ }
    if (!response.ok) throw new Error(data?.error || data?.message || `You.com failed (${response.status})`);
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

function textOrNull(value, max = 1000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function moneyOrNull(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  const text = String(value || '').replace(/,/g, '').trim();
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*([kmbt])?/i);
  if (!match) return null;
  const multiplier = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[String(match[2] || '').toLowerCase()] || 1;
  const number = Number(match[1]) * multiplier;
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function clamp(value, min, max, fallback) {
  let number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number > 1 && max <= 1) number /= 100;
  return Math.min(max, Math.max(min, number));
}

function sourcesFrom(payload) {
  return (Array.isArray(payload?.output?.sources) ? payload.output.sources : [])
    .map((source) => ({
      title: textOrNull(source?.title, 200),
      url: textOrNull(source?.url, 1000),
      snippet: textOrNull(Array.isArray(source?.snippets) ? source.snippets.join(' ') : source?.snippet, 500),
    }))
    .filter((source) => /^https?:\/\//i.test(source.url || ''))
    .slice(0, 15);
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

function derived(tam, inputs, baseAcv = inputs.acv_usd) {
  const sam = Math.round(tam * inputs.serviceable_pct);
  const acvFactor = baseAcv > 0 ? inputs.acv_usd / baseAcv : 1;
  const som = Math.round(sam * inputs.target_share * acvFactor);
  const somTimeline = Array.from({ length: inputs.timeframe_years }, (_, index) => ({
    year: index + 1,
    value_usd: Math.round((som * (index + 1)) / inputs.timeframe_years),
  }));
  return { sam, som, somTimeline };
}

function normalizeModel(raw, sources) {
  const inputRaw = raw?.inputs || {};
  const inputs = {
    geography: textOrNull(inputRaw.geography, 80) || 'Global',
    serviceable_pct: clamp(inputRaw.serviceable_pct, 0, 1, 0.3),
    acv_usd: moneyOrNull(inputRaw.acv_usd) || 1200,
    target_share: clamp(inputRaw.target_share, 0, 0.5, 0.02),
    timeframe_years: Math.round(clamp(inputRaw.timeframe_years, 1, 7, 3)),
    annual_growth_pct: clamp(inputRaw.annual_growth_pct, 0, 1, 0.15),
  };
  const tamValue = moneyOrNull(raw?.tam?.value_usd);
  if (!tamValue) throw new Error('You.com could not find a defensible TAM figure for this market.');
  const computed = derived(tamValue, inputs);
  const sourceAttribution = attribution(sources);
  const customerCount = moneyOrNull(raw?.bottom_up?.customers);
  const bottomAcv = moneyOrNull(raw?.bottom_up?.acv_usd) || inputs.acv_usd;

  return {
    category: textOrNull(raw?.category, 160),
    icp: textOrNull(raw?.icp, 200),
    tam: {
      value_usd: tamValue,
      low_usd: moneyOrNull(raw?.tam?.low_usd),
      high_usd: moneyOrNull(raw?.tam?.high_usd),
      confidence: ['low', 'medium', 'high'].includes(raw?.tam?.confidence) ? raw.tam.confidence : 'medium',
      sourced: raw?.tam?.sourced !== false,
      source_quote: textOrNull(raw?.tam?.source_quote, 500),
      method: textOrNull(raw?.tam?.method, 500) || 'You.com research synthesis',
    },
    sam: {
      value_usd: computed.sam,
      method: textOrNull(raw?.sam?.method, 300) || `${Math.round(inputs.serviceable_pct * 100)}% serviceable share of TAM`,
    },
    som: {
      value_usd: computed.som,
      method: textOrNull(raw?.som?.method, 300) || `${Math.round(inputs.target_share * 100)}% obtainable share of SAM`,
    },
    bottom_up: customerCount ? {
      customers: customerCount,
      customers_sourced: raw?.bottom_up?.customers_sourced === true,
      acv_usd: bottomAcv,
      acv_sourced: raw?.bottom_up?.acv_sourced === true,
      value_usd: Math.round(customerCount * bottomAcv),
      note: textOrNull(raw?.bottom_up?.note, 500),
    } : null,
    reconciliation: textOrNull(raw?.reconciliation, 1000),
    inputs,
    inputs_base: { ...inputs },
    som_timeline: computed.somTimeline,
    levers: (Array.isArray(raw?.levers) ? raw.levers : []).map((lever) => ({
      lever: textOrNull(lever?.lever, 180),
      target_layer: ['SAM', 'SOM', 'ACV'].includes(lever?.target_layer) ? lever.target_layer : 'SOM',
      effect: textOrNull(lever?.effect, 300),
      requires: textOrNull(lever?.requires, 300),
      impact: lever?.impact && typeof lever.impact === 'object' ? lever.impact : null,
    })).filter((lever) => lever.lever).slice(0, 5),
    summary: textOrNull(raw?.summary, 1200),
    sources,
    attribution: sourceAttribution,
    skill: sourceAttribution.skill,
    skillLabel: sourceAttribution.skillLabel,
    engine: sourceAttribution.engine,
    generatedAt: new Date().toISOString(),
  };
}

async function research(prompt, timeoutMs = 42000) {
  const payload = await fetchJson('https://api.you.com/v1/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.YOUCOM_API_KEY },
    body: JSON.stringify({ input: prompt, research_effort: 'lite' }),
  }, timeoutMs);
  const result = parseJson(payload?.output?.content);
  if (!result) throw new Error('You.com returned an unreadable result.');
  return { result, sources: sourcesFrom(payload) };
}

function searchRows(payload) {
  return [
    ...(Array.isArray(payload?.results?.web) ? payload.results.web : []),
    ...(Array.isArray(payload?.results?.news) ? payload.results.news : []),
  ];
}

function searchSources(rows) {
  const seen = new Set();
  return rows.map((row) => ({
    title: textOrNull(row?.title, 200),
    url: textOrNull(row?.url, 1000),
    snippet: textOrNull([row?.description, ...(Array.isArray(row?.snippets) ? row.snippets : [])].filter(Boolean).join(' '), 500),
  })).filter((source) => {
    if (!/^https?:\/\//i.test(source.url || '') || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 15);
}

function marketStatsFromRows(rows) {
  const moneyPattern = /(?:market\s+(?:size|value)|valued\s+at|worth|reached|estimated\s+(?:at|to\s+be))[^$]{0,100}\$\s*([\d,.]+)\s*(trillion|billion|million|[tmb])\b/i;
  const reverseMoneyPattern = /\$\s*([\d,.]+)\s*(trillion|billion|million|[tmb])\b[^.]{0,100}(?:market\s+(?:size|value)|market)/i;
  const cagrPattern = /(?:CAGR[^\d]{0,30}([\d.]+)\s*%|([\d.]+)\s*%[^.]{0,30}CAGR)/i;
  const multipliers = { million: 1e6, m: 1e6, billion: 1e9, b: 1e9, trillion: 1e12, t: 1e12 };

  for (const row of rows) {
    const text = [row?.title, row?.description, ...(Array.isArray(row?.snippets) ? row.snippets : [])]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ');
    const money = text.match(moneyPattern) || text.match(reverseMoneyPattern);
    if (!money) continue;
    const value = Number(String(money[1]).replace(/,/g, '')) * multipliers[String(money[2]).toLowerCase()];
    if (!Number.isFinite(value) || value < 1e6) continue;
    const cagr = text.match(cagrPattern);
    const growth = Number(cagr?.[1] || cagr?.[2]);
    return {
      value: Math.round(value),
      growth: Number.isFinite(growth) ? Math.min(1, Math.max(0, growth / 100)) : 0.15,
      quote: text.slice(Math.max(0, (money.index || 0) - 80), (money.index || 0) + money[0].length + 120),
      sourceTitle: textOrNull(row?.title, 200),
    };
  }
  return null;
}

async function searchFallbackModel(product) {
  const name = textOrNull(product?.name, 160);
  const description = textOrNull(product?.description, 500) || name;
  const queries = [
    `${description} market size CAGR TAM`,
    `${name} industry category global market size 2025`,
  ];
  const payloads = await Promise.all(queries.map((query) => fetchJson('https://ydc-index.io/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.YOUCOM_API_KEY },
    body: JSON.stringify({ query, count: 10 }),
  }, 10000)));
  const rows = payloads.flatMap(searchRows);
  const sources = searchSources(rows);
  const stats = marketStatsFromRows(rows);
  if (!stats) throw new Error('You.com could not find a defensible market-size figure. Add more product detail in Analysis and try again.');

  return normalizeModel({
    category: `${name} addressable market`,
    icp: 'Target customers described in the product profile',
    tam: {
      value_usd: stats.value,
      confidence: 'low',
      sourced: true,
      source_quote: stats.quote,
      method: `Fast You.com Search fallback${stats.sourceTitle ? ` using ${stats.sourceTitle}` : ''}; confirm category scope`,
    },
    sam: { method: 'Conservative 30% serviceable share of the sourced TAM' },
    som: { method: 'Conservative 2% obtainable share of SAM' },
    inputs: {
      geography: 'Global',
      serviceable_pct: 0.3,
      acv_usd: 1200,
      target_share: 0.02,
      timeframe_years: 3,
      annual_growth_pct: stats.growth,
    },
    levers: [
      { lever: 'Narrow the ideal customer profile', target_layer: 'SAM', effect: 'Improves serviceable-market precision', requires: 'Segment-level customer research', impact: { input: 'serviceable_pct', to: 0.4 } },
      { lever: 'Strengthen repeatable acquisition', target_layer: 'SOM', effect: 'Raises obtainable share', requires: 'A measured go-to-market channel', impact: { input: 'target_share', to: 0.04 } },
      { lever: 'Package higher-value workflows', target_layer: 'ACV', effect: 'Raises annual value per customer', requires: 'Validated premium use cases', impact: { input: 'acv_usd', to: 2400 } },
    ],
    summary: `You.com Search found a sourced market-size reference of ${stats.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. The initial SAM and SOM are conservative editable assumptions; validate the market category before using this model externally.`,
  }, sources);
}

function buildPrompt(product) {
  return `Build a current, sourced TAM/SAM/SOM market model for this product:
Name: ${textOrNull(product?.name, 160)}
Website: ${textOrNull(product?.pricing_url || product?.website, 500)}
Description: ${textOrNull(product?.description, 1200) || 'Not provided'}

Return only valid JSON with this exact shape:
{"category":"","icp":"","tam":{"value_usd":0,"low_usd":0,"high_usd":0,"confidence":"low|medium|high","sourced":true,"source_quote":"","method":""},"sam":{"method":""},"som":{"method":""},"bottom_up":{"customers":0,"customers_sourced":true,"acv_usd":0,"acv_sourced":false,"note":""},"reconciliation":"","inputs":{"geography":"Global","serviceable_pct":0.3,"acv_usd":1200,"target_share":0.02,"timeframe_years":3,"annual_growth_pct":0.15},"levers":[{"lever":"","target_layer":"SAM|SOM|ACV","effect":"","requires":"","impact":{"input":"serviceable_pct|target_share|acv_usd","to":0.4}}],"summary":""}

Rules: all money values are plain USD numbers, never formatted strings. Ground TAM in a concrete current source and scope it to the named category and geography. Use conservative assumptions for SAM and SOM. Do not invent a source or quote. If a bottom-up customer count is not sourced, set customers_sourced false. Include 3-5 distinct, actionable levers.`;
}

function factCheckPrompt(model, product) {
  return `Independently verify this market model using current credible sources.
Product: ${textOrNull(product?.name, 160) || 'Product'}
MODEL: ${JSON.stringify(model).slice(0, 16000)}

Return only valid JSON:
{"checks":[{"claim":"","verdict":"supported|mixed|unsupported","finding":"","confidence":"low|medium|high","kind":"market|assumption|input"}],"suggested_tam_usd":null,"overall":""}
Check the TAM category, scope, value, growth, and any sourced customer-count claim. Treat SAM/SOM percentages and ACV as user assumptions, not published facts. suggested_tam_usd must be a plain USD number or null.`;
}

function deterministicScenarios(base) {
  const tam = moneyOrNull(base?.tam) || 0;
  const sam = moneyOrNull(base?.sam) || Math.round(tam * 0.3);
  const som = moneyOrNull(base?.som) || Math.round(sam * 0.02);
  return {
    scenarios: [
      {
        name: 'bear',
        tamUsd: Math.round(tam * 0.85),
        samUsd: Math.round(sam * 0.7),
        somUsd: Math.round(som * 0.5),
        assumptions: ['Slower category growth', 'Narrower serviceable segment', 'Lower obtainable share'],
        probability: 0.25,
      },
      {
        name: 'base',
        tamUsd: tam,
        samUsd: sam,
        somUsd: som,
        assumptions: ['Current sourced TAM', 'Current serviceable share', 'Current obtainable-share target'],
        probability: 0.5,
      },
      {
        name: 'bull',
        tamUsd: Math.round(tam * 1.2),
        samUsd: Math.round(sam * 1.3),
        somUsd: Math.round(som * 2),
        assumptions: ['Faster category growth', 'Broader serviceable reach', 'Stronger repeatable acquisition'],
        probability: 0.25,
      },
    ],
    narrative: 'Scenarios vary the sourced baseline without changing its underlying evidence. Adjust the editable assumptions to make them specific to your plan.',
  };
}

export async function GET() {
  return Response.json({ model: null, persistence: 'browser-local', provider: 'youcom-research' });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  if (!process.env.YOUCOM_API_KEY) return Response.json({ error: 'You.com research is not configured.', code: 'MISSING_KEY' }, { status: 503 });

  const action = String(body?.action || 'build');
  try {
    if (action === 'fact-check') {
      if (!body?.model) return Response.json({ error: 'Build a market model first.' }, { status: 400 });
      const checked = await research(factCheckPrompt(body.model, body?.product));
      const sourceAttribution = attribution(checked.sources);
      const checks = (Array.isArray(checked.result?.checks) ? checked.result.checks : []).map((check) => ({
        claim: textOrNull(check?.claim, 500),
        verdict: ['supported', 'mixed', 'unsupported'].includes(check?.verdict) ? check.verdict : 'mixed',
        finding: textOrNull(check?.finding, 800),
        confidence: ['low', 'medium', 'high'].includes(check?.confidence) ? check.confidence : 'medium',
        kind: ['market', 'assumption', 'input'].includes(check?.kind) ? check.kind : 'market',
      })).filter((check) => check.claim).slice(0, 8);
      return Response.json({
        factCheck: {
          checks,
          suggested_tam_usd: moneyOrNull(checked.result?.suggested_tam_usd),
          overall: textOrNull(checked.result?.overall, 1000),
          sources: checked.sources,
          attribution: sourceAttribution,
          skill: sourceAttribution.skill,
          skillLabel: sourceAttribution.skillLabel,
          engine: sourceAttribution.engine,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'scenarios') {
      if (!body?.base) return Response.json({ error: 'Market model inputs are required.' }, { status: 400 });
      return Response.json({ result: deterministicScenarios(body.base), provider: 'deterministic' });
    }

    if (!textOrNull(body?.product?.name, 160)) {
      return Response.json({ error: 'Set up your product in Analysis first.', code: 'NO_PRODUCT' }, { status: 400 });
    }
    try {
      const built = await research(buildPrompt(body.product), 26000);
      return Response.json({ model: normalizeModel(built.result, built.sources) });
    } catch {
      return Response.json({ model: await searchFallbackModel(body.product), fallback: 'youcom-search' });
    }
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return Response.json(
      { error: timedOut ? 'You.com research timed out. Please try again.' : (error?.message || 'Market research failed.') },
      { status: timedOut ? 504 : 502 }
    );
  }
}
