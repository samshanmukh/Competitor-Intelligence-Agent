/**
 * Normalize You.com / search engines into a consistent attribution payload:
 * { skill, skillLabel, engine, sources: [{ title, url, snippet }] }
 */

export const YOU_SKILLS = {
  'youcom-search': { skill: 'you-web', label: 'You.com Search' },
  'you-web': { skill: 'you-web', label: 'You.com Search' },
  'youcom-research': { skill: 'you-research', label: 'You.com Research' },
  'you-research': { skill: 'you-research', label: 'You.com Research' },
  'youcom-finance': { skill: 'you-finance', label: 'You.com Finance' },
  'youcom-fallback': { skill: 'you-finance', label: 'You.com Finance' },
  'you-finance': { skill: 'you-finance', label: 'You.com Finance' },
  'youcom-contents': { skill: 'you-contents', label: 'You.com Contents' },
  'you-contents': { skill: 'you-contents', label: 'You.com Contents' },
  tavily: { skill: 'tavily', label: 'Tavily' },
  grok: { skill: 'grok', label: 'xAI Grok' },
};

export function skillMeta(engine) {
  return YOU_SKILLS[engine] || { skill: engine || 'unknown', label: engine || 'Unknown' };
}

/** Pull [{title,url,snippet}] from You.com / Tavily-ish payloads. */
export function normalizeSources(payload, limit = 8) {
  const out = [];
  const seen = new Set();
  const push = (title, url, snippet) => {
    const href = typeof url === 'string' ? url.trim() : '';
    if (!href || !/^https?:\/\//i.test(href) || seen.has(href)) return;
    seen.add(href);
    out.push({
      title: (title && String(title).trim()) || href,
      url: href,
      snippet: snippet ? String(snippet).trim().slice(0, 280) : null,
    });
  };

  if (!payload) return out;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item) continue;
      if (typeof item === 'string') {
        if (/^https?:\/\//i.test(item)) push(item, item, null);
        continue;
      }
      push(
        item.title || item.name,
        item.url || item.link || item.source_url,
        item.snippet || item.description || (Array.isArray(item.snippets) ? item.snippets.join(' ') : null)
      );
    }
    return out.slice(0, limit);
  }

  if (Array.isArray(payload.sources)) {
    for (const s of payload.sources) {
      push(s.title || s.name, s.url || s.link, s.snippet || (Array.isArray(s.snippets) ? s.snippets.join(' ') : null));
    }
  }
  if (payload.output?.sources) {
    for (const s of payload.output.sources) {
      push(s.title, s.url, Array.isArray(s.snippets) ? s.snippets.join(' ') : s.snippet);
    }
  }
  for (const bucket of [payload.results, payload.hits, payload.web_results, payload.citations]) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      push(item.title || item.name, item.url || item.link, item.snippet || item.description);
    }
  }
  if (payload.results && typeof payload.results === 'object' && !Array.isArray(payload.results)) {
    for (const key of ['web', 'news']) {
      if (!Array.isArray(payload.results[key])) continue;
      for (const item of payload.results[key]) {
        push(item.title || item.name, item.url || item.link, item.snippet || item.description);
      }
    }
  }

  return out.slice(0, limit);
}

export function makeAttribution(engine, payloadOrSources, { limit = 8 } = {}) {
  const meta = skillMeta(engine);
  const sources = Array.isArray(payloadOrSources) && payloadOrSources[0]?.url != null
    ? normalizeSources(payloadOrSources, limit)
    : normalizeSources(payloadOrSources, limit);
  return {
    skill: meta.skill,
    skillLabel: meta.label,
    engine: engine || meta.skill,
    sources,
  };
}

/** Merge several attribution objects (dedupe sources, keep first skill or list skills). */
export function mergeAttributions(list, { limit = 12 } = {}) {
  const skills = [];
  const seenSkill = new Set();
  const sources = [];
  const seenUrl = new Set();
  for (const a of list || []) {
    if (!a) continue;
    if (a.skill && !seenSkill.has(a.skill)) {
      seenSkill.add(a.skill);
      skills.push({ skill: a.skill, skillLabel: a.skillLabel || skillMeta(a.engine || a.skill).label });
    }
    for (const s of a.sources || []) {
      if (!s?.url || seenUrl.has(s.url)) continue;
      seenUrl.add(s.url);
      sources.push(s);
      if (sources.length >= limit) break;
    }
  }
  return { skills, sources };
}
