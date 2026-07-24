'use client';

import { Shimmer } from '../ui';
import { SkillChipRow } from '../SourceAttribution';

/**
 * Shared lab chrome — matches Analysis progressive UI (glass header, shimmer busy).
 */
export function LabShell({ title, subtitle, children, action, wide = true, skills }) {
  return (
    <div className={`mx-auto w-full min-w-0 space-y-6 pb-20 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <header className="glass-nav flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}
          {skills?.length > 0 && (
            <SkillChipRow skills={skills} size="md" className="mt-3" />
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </header>
      {children}
    </div>
  );
}

export function LabPanel({ title, children, ready, className = '', skills, skill, skillLabel }) {
  const showSkills = skills?.length || skill;
  return (
    <section className={`glass rounded-2xl p-5 ${className}`.trim()}>
      {(title || ready || showSkills) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
            {ready && (
              <span className="tab-ready rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-soft">
                Ready
              </span>
            )}
          </div>
          {showSkills && (
            <SkillChipRow
              skills={skills}
              skill={skill}
              skillLabel={skillLabel}
              size="md"
            />
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function LabShimmerBlock({ rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <Shimmer className="h-4 w-2/5" />
      <Shimmer className="h-28 w-full rounded-xl" />
      {Array.from({ length: Math.max(0, rows - 1) }).map((_, i) => (
        <Shimmer key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
