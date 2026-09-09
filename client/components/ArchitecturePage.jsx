'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from './ui';
import BrandLogo from './BrandLogo';
import { SkillChipRow } from './SourceAttribution';

const EASE = [0.21, 0.47, 0.32, 0.98];

function Reveal({ children, delay = 0, y = 20, className = '' }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={reduceMotion ? undefined : { duration: 0.55, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const TOC = [
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'system', label: 'System design' },
  { id: 'stack', label: 'Tech stack' },
  { id: 'youcom', label: 'You.com' },
  { id: 'hosting', label: 'Hosting' },
  { id: 'integrations', label: 'Integrations' },
];

/** End-to-end blueprint: UI → API → providers → product surfaces */
const BLUEPRINT_LANES = [
  {
    id: 'edge',
    title: 'Edge',
    subtitle: 'Users & delivery',
    color: 'sky',
    nodes: [
      { name: 'joinmira.ai', detail: 'Next.js 15 · Vercel' },
      { name: 'Open site', detail: 'No login or session gate' },
      { name: 'Workspace', detail: 'Analysis · Labs · Market' },
    ],
  },
  {
    id: 'api',
    title: 'Control plane',
    subtitle: 'Express API',
    color: 'accent',
    nodes: [
      { name: 'REST + jobs', detail: 'Background market / deep dive' },
      { name: 'Agents', detail: 'discover · fetch · digests' },
      { name: 'Cron', detail: '24h refresh · weekly mail' },
    ],
  },
  {
    id: 'data',
    title: 'Data plane',
    subtitle: 'PostgreSQL + JSON',
    color: 'emerald',
    nodes: [
      { name: 'Postgres', detail: 'Products · competitors · snapshots' },
      { name: 'Feature requests', detail: 'Local JSON file' },
      { name: 'Settings', detail: 'Workspace data · keys' },
    ],
  },
  {
    id: 'intel',
    title: 'Intelligence',
    subtitle: 'You.com Research APIs',
    color: 'violet',
    nodes: [
      { name: 'you-web', detail: 'Search · Evidence · fact-check' },
      { name: 'you-research', detail: 'Reviews · talk tracks · overview' },
      { name: 'you-finance', detail: 'TAM · investor · market model' },
      { name: 'you-contents', detail: 'Pricing pages · site text' },
    ],
  },
];

const BLUEPRINT_FLOWS = [
  {
    title: 'Analysis report',
    path: ['UI /app', 'API layers', 'You.com research', 'Structured report', 'Persist analysis-latest'],
    skills: ['you-contents', 'you-research', 'you-finance'],
  },
  {
    title: 'Market model',
    path: ['UI /market', 'Persistent API job', 'you-finance', 'Optional Tavily check', 'TAM → SAM → SOM'],
    skills: ['you-finance', 'tavily'],
  },
  {
    title: 'Evidence locker',
    path: ['UI Labs', 'You.com search', 'You.com candidates', 'Save locally'],
    skills: ['you-web'],
  },
  {
    title: 'Deep dive',
    path: ['UI /company', 'Parallel sections', 'you-research + you-finance', 'Dossier + sources'],
    skills: ['you-research', 'you-finance', 'you-contents'],
  },
];

const LAYERS = [
  {
    title: 'Browser',
    subtitle: 'joinmira.ai',
    body: 'Next.js App Router UI for marketing pages and the open workspace.',
    tone: 'border-white/10 bg-white/[0.04]',
  },
  {
    title: 'API',
    subtitle: 'Node · Express',
    body: 'Persistent Node process for discovery, market jobs, cron refresh, and digests.',
    tone: 'border-accent/30 bg-accent/10',
  },
  {
    title: 'Data',
    subtitle: 'PostgreSQL',
    body: 'Shared workspaces, settings, reports, jobs, and market intelligence data.',
    tone: 'border-emerald-500/25 bg-emerald-500/10',
  },
  {
    title: 'Intelligence',
    subtitle: 'You.com',
    body: 'Live research, source retrieval, and structured analysis from You.com.',
    tone: 'border-sky-500/25 bg-sky-500/10',
  },
];

const STACK = [
  { layer: 'Frontend', items: [
    { name: 'Next.js 15', role: 'App Router and server-rendered pages' },
    { name: 'React 18', role: 'Client components for workspace UIs' },
    { name: 'Tailwind CSS 3.4', role: 'Design system tokens (ink + accent)' },
    { name: 'Framer Motion / Recharts', role: 'Landing motion and in-app charts' },
  ]},
  { layer: 'API', items: [
    { name: 'Express', role: 'REST orchestration and long-running jobs' },
    { name: 'node-cron', role: '24h competitor refresh + weekly digests' },
    { name: 'pg', role: 'Server-side PostgreSQL access' },
  ]},
  { layer: 'AI & research', items: [
    { name: 'You.com API', role: 'research, contents, finance_research' },
    { name: 'Tavily (optional)', role: 'Independent fact-check for market models' },
  ]},
  { layer: 'Platform', items: [
    { name: 'PostgreSQL', role: 'Workspace and intelligence data' },
    { name: 'JSON store', role: 'Dependency-free public feature requests' },
    { name: 'Vercel', role: 'Preferred frontend host for joinmira.ai' },
    { name: 'Resend / Zendesk', role: 'Transactional email and in-app support' },
  ]},
];

const YOUCOM_APIS = [
  {
    name: 'search',
    skill: 'you-web',
    endpoint: 'POST /v1/search',
    use: 'Cheap web search for Evidence research and fact-check before finance.',
  },
  {
    name: 'research',
    skill: 'you-research',
    endpoint: 'POST /v1/research',
    use: 'Competitor discovery, reviews, war-room talk tracks, company overview.',
  },
  {
    name: 'contents',
    skill: 'you-contents',
    endpoint: 'POST /v1/contents',
    use: 'Fetch pricing pages and site text for snapshots and ICP/pricing layers.',
  },
  {
    name: 'finance_research',
    skill: 'you-finance',
    endpoint: 'POST /v1/finance_research',
    use: 'Market sizing, investor enrich, market model, deep-dive financials.',
  },
];

const YOUCOM_FLOWS = [
  {
    title: 'Discover competitors',
    steps: ['UI calls /api/discover', 'API sends product context to research', 'You.com finds the rival set', 'Candidates are normalized for approval'],
  },
  {
    title: 'Refresh snapshots',
    steps: ['Cron or manual refresh', 'fetchAgent pulls pages via contents', 'Diff detects pricing / messaging changes', 'Workspace surfaces alerts'],
  },
  {
    title: 'Market model',
    steps: ['Market intelligence job starts', 'finance_research sizes the market', 'You.com builds the TAM→SOM narrative', 'Optional Tavily fact-check'],
  },
  {
    title: 'Company deep dive',
    steps: ['Company routes request overview', 'research + finance_research enrich', 'Reviews and financials land in UI', 'Distribution uses share / traffic signals'],
  },
];

const HOSTING = [
  {
    name: 'Node API host',
    badge: 'API required',
    points: [
      'cia-api, Express server with health check at /api/health',
      'Holds You.com, Resend, and cron secrets',
      'Needed for 2–3 minute market jobs and scheduled refresh',
      'Deployable to any persistent Node.js environment',
    ],
  },
  {
    name: 'Vercel',
    badge: 'Frontend',
    points: [
      'Hosts the Next.js client (root directory: client)',
      'Serves joinmira.ai / www.joinmira.ai',
      'Runs server-rendered pages and feature-request APIs',
      'NEXT_PUBLIC_API_BASE points at the active API URL',
    ],
  },
  {
    name: 'PostgreSQL',
    badge: 'Data plane',
    points: [
      'Persistent workspace and intelligence data',
      'Used by the Express API through the pg client',
      'Shared workspace selection without user sessions',
    ],
  },
];

const INTEGRATIONS = [
  { name: 'PostgreSQL', role: 'Workspace and intelligence data', where: 'server/db' },
  { name: 'You.com', role: 'Live web research and page contents', where: 'server/services/youcom.js' },
  { name: 'Resend', role: 'Digests and support mail', where: 'server/services/email.js' },
  { name: 'Tavily', role: 'Market-model fact-check', where: 'server/services/tavily.js' },
  { name: 'Zendesk', role: 'In-app messaging widget', where: 'ZendeskWidget.jsx' },
  { name: 'Web Push', role: 'Browser notifications (VAPID)', where: 'server/services/push.js' },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950 text-slate-200">
      <header className="glass-nav sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <BrandLogo href="/" height={32} priority />
          <nav className="hidden items-center gap-6 text-sm text-slate-400 lg:flex">
            {TOC.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="transition hover:text-white">{item.label}</a>
            ))}
          </nav>
          <Link href="/app" className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200">Go to app</Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden px-5 pb-12 pt-16 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute left-[15%] top-[-10%] h-[360px] w-[360px] rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute right-[10%] top-[20%] h-[280px] w-[280px] rounded-full bg-sky-500/10 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft">Architecture</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            How Mira is built
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            Blueprint of the product stack, website, Express API, PostgreSQL data, and You.com skills
            that power live competitive intelligence.
          </p>
          <a
            href="#blueprint"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 transition hover:text-sky-200"
          >
            View blueprint <Icon name="chevronRight" className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Blueprint architect */}
      <section id="blueprint" className="scroll-mt-24 px-5 pb-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Blueprint architect</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">System blueprint</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Four lanes from the browser to intelligence providers. Skills on the right map 1:1 to
              chips you see in the product UI.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="blueprint-board relative mt-8 overflow-hidden rounded-3xl border border-sky-500/20">
            {/* Blueprint grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-950/40 via-ink-950/80 to-ink-950" aria-hidden="true" />

            <div className="relative p-5 sm:p-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-sky-500/20 pb-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-sky-300/70">Mira · v1 blueprint</p>
                  <p className="mt-1 text-sm text-slate-400">Edge → control plane → data → intelligence</p>
                </div>
                <SkillChipRow
                  size="sm"
                  skills={[
                    { skill: 'you-web' },
                    { skill: 'you-research' },
                    { skill: 'you-finance' },
                    { skill: 'you-contents' },
                  ]}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                {BLUEPRINT_LANES.map((lane, i) => (
                  <motion.div
                    key={lane.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                    className="relative flex flex-col rounded-2xl border border-sky-400/20 bg-sky-950/30 p-4 backdrop-blur-sm"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-sky-300/60">
                          Lane {String(i + 1).padStart(2, '0')}
                        </p>
                        <h3 className="text-base font-semibold text-white">{lane.title}</h3>
                        <p className="text-xs text-slate-500">{lane.subtitle}</p>
                      </div>
                      {i < BLUEPRINT_LANES.length - 1 && (
                        <span className="hidden text-sky-400/50 lg:inline" aria-hidden="true">→</span>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {lane.nodes.map((node) => (
                        <li
                          key={node.name}
                          className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5"
                        >
                          <p className="text-sm font-medium text-sky-50">{node.name}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{node.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>

              {/* Flow arrows for mobile */}
              <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-sky-500/50 lg:hidden">
                Scroll lanes · left to right on desktop
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="mt-8">
            <h3 className="text-lg font-semibold text-white">Request blueprints</h3>
            <p className="mt-1 text-sm text-slate-400">
              How a user action becomes a You.com skill call and lands back in the UI with source chips.
            </p>
          </Reveal>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {BLUEPRINT_FLOWS.map((flow, i) => (
              <Reveal key={flow.title} delay={0.05 + i * 0.04}>
                <div className="glass h-full rounded-2xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-semibold text-white">{flow.title}</h4>
                    <SkillChipRow skills={flow.skills.map((s) => ({ skill: s }))} size="sm" />
                  </div>
                  <ol className="mt-4 space-y-2">
                    {flow.path.map((step, j) => (
                      <li key={j} className="flex gap-2.5 text-sm text-slate-400">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 font-mono text-[10px] text-sky-300">
                          {j + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} className="mt-8 overflow-hidden rounded-2xl border border-sky-500/20 bg-sky-950/20 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/80">Hosting split</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Vercel', body: 'Next.js frontend · joinmira.ai · public routes' },
                { title: 'Node host', body: 'Express API · long jobs · cron · secrets' },
                { title: 'Data', body: 'PostgreSQL app data · JSON feature requests' },
              ].map((b) => (
                <div key={b.title} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{b.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{b.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* System */}
      <section id="system" className="scroll-mt-24 border-t border-white/5 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-2xl font-semibold text-white">System design</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              The website talks to a persistent Express API. That API owns long jobs and secrets;
              Browser storage and JSON keep the open workspace lightweight; You.com supplies live research and structure.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LAYERS.map((layer, i) => (
              <Reveal key={layer.title} delay={i * 0.06}>
                <div className={`h-full rounded-2xl border p-5 backdrop-blur-xl ${layer.tone}`}>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{layer.subtitle}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{layer.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{layer.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} className="glass mt-8 overflow-x-auto rounded-2xl p-5 sm:p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Request path</p>
            <div className="flex min-w-[640px] flex-col items-stretch gap-3 text-sm md:min-w-0">
              {[
                ['Website', 'Next.js on Vercel, Discover, Market, Company, Distribution'],
                ['API base', 'NEXT_PUBLIC_API_BASE → Express API + shared workspace'],
                ['Orchestration', 'Agents & routes: discover → refresh → market intel → digests'],
                ['Providers', 'You.com research/contents/finance · optional Tavily'],
                ['Persistence', 'PostgreSQL stores products, competitors, snapshots, and jobs'],
              ].map(([label, detail], i, arr) => (
                <div key={label}>
                  <div className="flex items-start gap-4 rounded-xl border border-white/5 bg-black/20 px-4 py-3 backdrop-blur-sm">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-soft">{i + 1}</span>
                    <div>
                      <p className="font-medium text-white">{label}</p>
                      <p className="mt-0.5 text-slate-400">{detail}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="ml-7 h-3 w-px bg-white/10" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="scroll-mt-24 border-t border-white/5 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-2xl font-semibold text-white">Tech stack</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              What each layer runs, and why it sits where it does.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {STACK.map((group, i) => (
              <Reveal key={group.layer} delay={i * 0.05}>
                <div className="glass h-full rounded-2xl p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent-soft">{group.layer}</h3>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <li key={item.name} className="flex gap-3 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>
                          <span className="font-medium text-white">{item.name}</span>
                          <span className="text-slate-500"> · </span>
                          <span className="text-slate-400">{item.role}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* You.com */}
      <section id="youcom" className="scroll-mt-24 border-t border-white/5 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-2xl font-semibold text-white">How we use You.com</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              You.com is the live research backbone. The website never calls You.com directly -
              the Express API owns the key, rate-limits requests, and maps results into Mira features.
            </p>
          </Reveal>

          <Reveal className="mt-8 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5 backdrop-blur-xl sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/80">Client module</p>
            <p className="mt-2 font-mono text-sm text-sky-100/90">server/services/youcom.js</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Serializes outbound calls with spacing (<span className="font-mono text-slate-300">YOUCOM_MIN_INTERVAL_MS</span>),
              retries on 429/5xx, and exposes three operations used across agents and routes.
            </p>
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {YOUCOM_APIS.map((api, i) => (
              <Reveal key={api.name} delay={i * 0.05}>
                <div className="glass h-full rounded-2xl p-5">
                  <SkillChipRow skills={[{ skill: api.skill }]} size="sm" className="mb-3" />
                  <p className="font-mono text-sm font-semibold text-white">{api.name}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{api.endpoint}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{api.use}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <h3 className="text-lg font-semibold text-white">Wired into the product</h3>
            <p className="mt-1 text-sm text-slate-400">Each flow starts in the Next.js UI and lands in a You.com call on the API.</p>
          </Reveal>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {YOUCOM_FLOWS.map((flow, i) => (
              <Reveal key={flow.title} delay={i * 0.04}>
                <div className="glass-soft h-full rounded-2xl p-5">
                  <h4 className="font-medium text-white">{flow.title}</h4>
                  <ol className="mt-3 space-y-2">
                    {flow.steps.map((step, j) => (
                      <li key={j} className="flex gap-2.5 text-sm text-slate-400">
                        <span className="font-mono text-xs text-accent-soft">{j + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 text-sm text-slate-500">
            Call sites include <span className="text-slate-400">discoveryAgent</span>,{' '}
            <span className="text-slate-400">fetchAgent</span>,{' '}
            <span className="text-slate-400">routes/intelligence</span>,{' '}
            <span className="text-slate-400">routes/company</span>, and{' '}
            <span className="text-slate-400">syndicatedShare</span>.
            You.com Research returns the structured JSON used by the UI, with source links preserved for verification.
          </Reveal>
        </div>
      </section>

      {/* Hosting */}
      <section id="hosting" className="scroll-mt-24 border-t border-white/5 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-2xl font-semibold text-white">Frontend, API, and data hosting</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Market jobs and cron need a process that stays alive, so the Express API is deployed
              separately from the Vercel frontend.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {HOSTING.map((block, i) => (
              <Reveal key={block.name} delay={i * 0.05}>
                <div className="glass h-full rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">{block.name}</h3>
                    <span className="chip text-slate-400">{block.badge}</span>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {block.points.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-400">
                        <span className="text-accent-soft">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="glass mt-8 rounded-2xl p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-white">Deploy config</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              The repository is vendor-neutral. Start the API with <span className="font-mono">npm start</span>{' '}
              and deploy the client from <span className="font-mono">client/</span>. In production, set
              <span className="font-mono text-slate-300"> NEXT_PUBLIC_API_BASE</span> to the active Express API URL.
              See the{' '}
              <a href="#blueprint" className="text-sky-300 hover:text-sky-200">system blueprint</a> for the full
              lane diagram.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="scroll-mt-24 border-t border-white/5 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-2xl font-semibold text-white">Other integrations</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Supporting services around research, messaging, and delivery.
            </p>
          </Reveal>
          <div className="glass mt-8 overflow-hidden rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Service</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Role</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Where</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {INTEGRATIONS.map((row) => (
                  <tr key={row.name} className="align-top">
                    <td className="px-4 py-3.5 font-medium text-white sm:px-5">{row.name}</td>
                    <td className="px-4 py-3.5 text-slate-400 sm:px-5">{row.role}</td>
                    <td className="hidden px-4 py-3.5 font-mono text-xs text-slate-500 sm:table-cell sm:px-5">{row.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <Reveal className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-gradient-to-b from-accent/12 to-ink-900 px-6 py-14 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">See it in the product</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Discover competitors, build a market model, and watch You.com-backed research land in your workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dim">
              Open app <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
            <Link href="/requests" className="rounded-md border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/30 hover:text-white">
              Feature requests
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <BrandLogo href="/" height={28} />
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/" className="transition hover:text-slate-300">Home</Link>
            <Link href="/requests" className="transition hover:text-slate-300">Feature requests</Link>
            <a href="#youcom" className="transition hover:text-slate-300">You.com</a>
            <a href="#hosting" className="transition hover:text-slate-300">Hosting</a>
          </div>
          <span className="text-xs text-slate-600">© {new Date().getFullYear()} Mira</span>
        </div>
      </footer>
    </div>
  );
}
