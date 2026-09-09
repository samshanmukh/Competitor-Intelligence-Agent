'use client';

/**
 * Demo-visible You.com skill chips + source links.
 *
 * attribution: { skill, skillLabel, engine, sources: [{title,url,snippet}] }
 *   OR { skills: [{skill,skillLabel}], sources: [...] }
 */

const SKILL_STYLES = {
  'you-web': 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  'you-research': 'border-violet-400/40 bg-violet-500/15 text-violet-200',
  'you-finance': 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  'you-contents': 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  tavily: 'border-orange-400/40 bg-orange-500/15 text-orange-200',
  grok: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200',
};

export function skillChip(engineOrSkill) {
  const map = {
    'you-web': 'You.com Search',
    'youcom-search': 'You.com Search',
    'you-research': 'You.com Research',
    'youcom-research': 'You.com Research',
    'you-finance': 'You.com Finance',
    'youcom-finance': 'You.com Finance',
    'youcom-fallback': 'You.com Finance',
    'you-contents': 'You.com Contents',
    'youcom-contents': 'You.com Contents',
    tavily: 'Tavily',
  };
  const skill = engineOrSkill === 'youcom-search' ? 'you-web'
    : engineOrSkill === 'youcom-research' ? 'you-research'
    : engineOrSkill === 'youcom-finance' || engineOrSkill === 'youcom-fallback' ? 'you-finance'
    : engineOrSkill === 'youcom-contents' ? 'you-contents'
    : engineOrSkill;
  return {
    skill,
    skillLabel: map[engineOrSkill] || map[skill] || engineOrSkill || 'Unknown',
  };
}

/** Standalone chip, hidden in product UI (kept as no-ops so call sites stay safe). */
export function SkillChip() {
  return null;
}

export function SkillChipRow() {
  return null;
}

export function SourceAttribution({
  attribution,
  sources,
  skills,
  skill,
  skillLabel,
  engine,
  className = '',
  compact = false,
  /** Skill chips are disabled in product UI; sources still render. */
  showSkill = false,
}) {
  const attrs = normalize(attribution, { sources, skills, skill, skillLabel, engine });
  if (!attrs.sources.length) return null;

  return (
    <div className={`mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 ${className}`.trim()}>
      {attrs.sources.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sources</p>
          <ul className={compact ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-1.5'}>
            {attrs.sources.map((s, i) => (
              <li key={`${s.url}-${i}`} className={compact ? 'inline' : ''}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-accent-soft underline-offset-2 hover:underline"
                  title={s.snippet || s.url}
                >
                  {truncate(s.title || s.url, compact ? 40 : 72)}
                </a>
                {!compact && s.snippet && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{s.snippet}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalize(attribution, extras = {}) {
  // Prefer explicit extras (call-site skill) so demos always get a chip.
  const fromExtras = [];
  if (Array.isArray(extras.skills) && extras.skills.length) {
    for (const s of extras.skills) {
      if (typeof s === 'string') fromExtras.push(skillChip(s));
      else if (s?.skill || s?.engine) {
        const c = skillChip(s.skill || s.engine);
        fromExtras.push({ skill: s.skill || c.skill, skillLabel: s.skillLabel || c.skillLabel });
      }
    }
  } else if (extras.skill || extras.engine) {
    const c = skillChip(extras.skill || extras.engine);
    fromExtras.push({
      skill: extras.skill || c.skill,
      skillLabel: extras.skillLabel || c.skillLabel,
    });
  }

  let fromAttr = [];
  if (attribution?.skills?.length) {
    fromAttr = attribution.skills;
  } else if (attribution?.skill || attribution?.engine) {
    const c = skillChip(attribution.skill || attribution.engine);
    fromAttr = [{
      skill: attribution.skill || c.skill,
      skillLabel: attribution.skillLabel || c.skillLabel,
    }];
  }

  const skills = [];
  const seen = new Set();
  for (const s of [...fromExtras, ...fromAttr]) {
    if (!s?.skill || seen.has(s.skill)) continue;
    seen.add(s.skill);
    skills.push(s);
  }

  const sourceList = [
    ...(extras.sources || []),
    ...(attribution?.sources || []),
  ].filter((s) => s?.url);

  const deduped = [];
  const seenUrl = new Set();
  for (const s of sourceList) {
    if (seenUrl.has(s.url)) continue;
    seenUrl.add(s.url);
    deduped.push(s);
  }

  return { skills, sources: deduped };
}

function truncate(s, n) {
  const t = String(s || '');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
