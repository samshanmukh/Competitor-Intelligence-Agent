// Traffic resolution: research (finance/company extraction + text scan) → relative rank proxy.
// Absolute visits come from You.com research; no third-party traffic scrapers.

function parseVisits(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/,/g, '');
  const m = s.match(/([\d.]+)\s*(trillion|billion|million|thousand|t|b|m|k)?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('t')) n *= 1e12;
  else if (unit.startsWith('b')) n *= 1e9;
  else if (unit.startsWith('m')) n *= 1e6;
  else if (unit.startsWith('k')) n *= 1e3;
  else if (n < 1000 && /visit|traffic|monthly/i.test(s)) n *= 1e6;
  return Math.round(n);
}

/** Pull monthly_visits from structured company rows (finance extraction). */
export function trafficFromCompanies(companies) {
  const byName = {};
  const kinds = {};
  for (const c of companies || []) {
    if (!c?.name) continue;
    const key = c.name.toLowerCase();
    const visits = parseVisits(c.monthly_visits) ?? parseVisits(c.web_traffic) ?? parseVisits(c.traffic);
    if (visits > 0) {
      byName[key] = visits;
      kinds[key] = 'research';
    }
  }
  return { byName, kinds };
}

/** Regex scan research text for visit counts near company names. */
export function trafficFromResearchText(text, competitors) {
  const byName = {};
  const kinds = {};
  if (!text || !competitors?.length) return { byName, kinds };

  const chunk = String(text).slice(0, 16000);
  for (const c of competitors) {
    const name = c.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`${escaped}[^.\\n]{0,120}?(\\d+(?:\\.\\d+)?)\\s*(million|m|billion|b|thousand|k)?\\s*(?:monthly\\s*)?(?:visits|traffic|users)`, 'i'),
      new RegExp(`(?:visits|traffic)[^.\\n]{0,80}?${escaped}[^.\\n]{0,60}?(\\d+(?:\\.\\d+)?)\\s*(million|m|billion|b|thousand|k)?`, 'i'),
    ];
    for (const re of patterns) {
      const m = chunk.match(re);
      if (!m) continue;
      const visits = parseVisits(`${m[1]} ${m[2] || ''}`.trim());
      if (visits > 0) {
        byName[key] = visits;
        kinds[key] = 'research';
        break;
      }
    }
  }
  return { byName, kinds };
}

/**
 * Relative rank proxy from research rank mentions.
 * Used only when no absolute visits exist for a competitor.
 */
export function relativeTrafficProxy(competitors, { researchRanks = {} } = {}) {
  const scores = {};
  for (const c of competitors || []) {
    const key = c.name?.toLowerCase();
    if (!key) continue;
    const rank = researchRanks[key];
    if (typeof rank === 'number' && rank > 0) {
      scores[key] = 1 / Math.log10(rank + 10);
    }
  }
  const max = Math.max(0, ...Object.values(scores));
  if (!max) return { byName: {}, kinds: {} };

  const byName = {};
  const kinds = {};
  for (const [key, score] of Object.entries(scores)) {
    byName[key] = Math.round((score / max) * 1e6);
    kinds[key] = 'relative';
  }
  return { byName, kinds };
}

function mergeTrafficMaps(...layers) {
  const byName = {};
  const kinds = {};
  const priority = { research: 2, relative: 1 };
  for (const layer of layers) {
    for (const [key, visits] of Object.entries(layer.byName || {})) {
      const kind = layer.kinds?.[key] || 'research';
      const prev = kinds[key];
      if (!prev || (priority[kind] || 0) >= (priority[prev] || 0)) {
        byName[key] = visits;
        kinds[key] = kind;
      }
    }
  }
  return { byName, kinds };
}

/**
 * Resolve traffic for all tracked competitors from research signals only.
 * @returns {{ byName: Record<string, number>, kinds: object, meta: object }}
 */
export async function resolveTrafficForCompetitors(competitors, { companies = [], researchText = '' } = {}) {
  const fromCompanies = trafficFromCompanies(companies);
  const fromText = trafficFromResearchText(researchText, competitors);

  let merged = mergeTrafficMaps(fromCompanies, fromText);

  const missing = (competitors || []).filter((c) => !merged.byName[c.name?.toLowerCase()]);
  if (missing.length) {
    const relative = relativeTrafficProxy(missing);
    merged = mergeTrafficMaps(merged, relative);
  }

  const counts = { research: 0, relative: 0 };
  for (const kind of Object.values(merged.kinds)) {
    if (counts[kind] != null) counts[kind]++;
  }

  return {
    byName: merged.byName,
    kinds: merged.kinds,
    meta: {
      configured: true,
      research: counts.research,
      relative: counts.relative,
      total: Object.keys(merged.byName).length,
      traffic_kinds: counts,
    },
  };
}

/** @deprecated use resolveTrafficForCompetitors */
export async function fetchTrafficSignals(competitors, opts = {}) {
  const result = await resolveTrafficForCompetitors(competitors, opts);
  return {
    byName: result.byName,
    configured: result.meta.configured,
    fetched: result.meta.research,
  };
}
