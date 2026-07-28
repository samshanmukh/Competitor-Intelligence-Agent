import Link from 'next/link';
import {
  AUTHOR,
  COMPARISON_ROWS,
  FAQS,
  GUIDE_PUBLISHED,
  GUIDE_UPDATED,
  ORG,
  SITE_ORIGIN,
} from '../lib/geoContent';

const h2 = 'mt-14 text-xl font-semibold tracking-tight text-slate-100 md:text-2xl';
const h3 = 'mt-8 text-lg font-semibold text-slate-200';
const p = 'mt-4 text-[15px] leading-[1.75] text-slate-400';
const strong = 'font-medium text-slate-200';
const a = 'text-slate-300 underline-offset-2 hover:underline';

/**
 * Long-form product / founder documentation for /guide.
 * Reads like a founder methodology guide, not a dense “facts for citation” dump.
 * Kept off the marketing homepage so the landing page stays clean for humans.
 */
export default function LandingProductDocs() {
  return (
    <article
      id="how-mira-works"
      aria-label="How Mira works: product documentation"
      className="border-t border-white/5 bg-ink-950/60"
      itemScope
      itemType="https://schema.org/Article"
    >
      <div className="mx-auto max-w-3xl px-5 py-16 md:py-20">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Product documentation · Last updated{' '}
            <time dateTime={GUIDE_UPDATED}>{GUIDE_UPDATED}</time>
          </p>
          <h1
            className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl"
            itemProp="headline"
          >
            How Mira works for founders
          </h1>
          <p className={`${p} max-w-2xl`} itemProp="description" id="mira-definition">
            Mira is competitive and market intelligence software for early-stage teams.
            Paste a product URL and Mira aims to return a first clarity snapshot in about{' '}
            <strong className={strong}>two minutes</strong> (~120 seconds): who you compete
            with, what they charge, how the market layers (TAM → SAM → SOM), and which moves
            matter next.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-slate-500">
            <span itemProp="author" itemScope itemType="https://schema.org/Person">
              By{' '}
              <Link href="/about" className={a} itemProp="url">
                <span itemProp="name">{AUTHOR.name}</span>
              </Link>
              , <span itemProp="jobTitle">{AUTHOR.jobTitle}</span> at {ORG.name}
            </span>
            {' · Published '}
            <time dateTime={GUIDE_PUBLISHED} itemProp="datePublished">
              {GUIDE_PUBLISHED}
            </time>
            {' · Updated '}
            <time dateTime={GUIDE_UPDATED} itemProp="dateModified">
              {GUIDE_UPDATED}
            </time>
            {' · Founded '}
            <time dateTime={ORG.foundingDate}>{ORG.foundingDate}</time>
            {' · '}
            <a className={a} href={`mailto:${ORG.email}`}>
              {ORG.email}
            </a>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Related pages:{' '}
            <Link href="/faq" className={a}>
              FAQ
            </Link>
            {' · '}
            <Link href="/about" className={a}>
              About
            </Link>
            {' · '}
            <Link href="/team" className={a}>
              Team
            </Link>
            {' · '}
            <Link href="/contact" className={a}>
              Contact
            </Link>
            {' · '}
            <Link href="/methodology" className={a}>
              Methodology
            </Link>
            {' · '}
            <Link href="/architecture" className={a}>
              Architecture
            </Link>
            .
          </p>
        </header>

        <div itemProp="articleBody">
          <h2 className={h2}>What Mira is (and what it is not)</h2>
          <p className={p}>
            Mira helps founders turn public market and competitor signals into decision support.
            You start from a product URL or a short market description. Mira discovers competitor
            candidates, extracts pricing tiers, builds feature and value matrices, sizes markets
            across three layers (TAM, SAM, and SOM), estimates competitor presence with labeled
            methodology, and produces battlecards, win-loss notes, and investor-ready briefs.
            The company behind the product is <strong className={strong}>{ORG.legalName}</strong>{' '}
            (brand: {ORG.name}), founded on{' '}
            <time dateTime={ORG.foundingDate}>{ORG.foundingDate}</time> by {AUTHOR.name}. The
            product surface is a web application at{' '}
            <a href={SITE_ORIGIN} className={a}>
              {SITE_ORIGIN}
            </a>
            ; support and press go to{' '}
            <a className={a} href={`mailto:${ORG.email}`}>
              {ORG.email}
            </a>
            .
          </p>
          <p className={p}>
            Mira is not a syndicated traffic panel, not a CRM, and not an enterprise battlecard CMS
            for large sales organizations. When Mira shows a presence or share-style estimate, treat
            it as directional unless the UI explicitly labels a published analyst figure. Full
            provenance rules live on the{' '}
            <Link href="/methodology" className={a}>
              methodology page
            </Link>
            .
          </p>

          <h2 className={h2}>Why founders need competitive intelligence early</h2>
          <p className={p}>
            Early-stage teams often under-invest in competitive intelligence because traditional
            tools assume a dedicated research function, and multi-week analyst retainers can run{' '}
            <strong className={strong}>$5,000–$25,000+</strong> (often <strong className={strong}>$150–$400/hour</strong>{' '}
            billed across <strong className={strong}>20–60 hours</strong>). The cost of that gap shows
            up as mistimed pricing, vague positioning, and feature roadmaps that chase anecdotes. A
            lightweight CI loop answers four recurring questions: Who else solves this job? What do
            they charge? Where are we stronger or weaker on capabilities buyers notice? What should
            we do next this quarter?
          </p>
          <p className={p}>
            In practice, founder CI is less about collecting every press mention and more about
            maintaining a living map of substitutes. Substitutes include direct competitors,
            adjacent tools buyers stitch together, and “do nothing / spreadsheets” baselines. Mira
            keeps that map structured so pricing, features, and market size stay in one workspace
            instead of scattered Notion pages and screenshots. Public guidance on market research
            and competitive analysis from the{' '}
            <a
              href="https://www.sba.gov/business-guide/plan-your-business/market-research-competitive-analysis"
              className={a}
              rel="noopener noreferrer"
              target="_blank"
            >
              U.S. Small Business Administration
            </a>{' '}
            and strategy framing such as{' '}
            <a
              href="https://www.isc.hbs.edu/strategy/business-strategy/Pages/the-five-forces.aspx"
              className={a}
              rel="noopener noreferrer"
              target="_blank"
            >
              Porter’s Five Forces (Harvard Business School)
            </a>{' '}
            still apply, Mira simply compresses the operational loop for seed-stage teams.
          </p>
          <p className={p}>
            For background on the discipline itself, see{' '}
            <a
              href="https://en.wikipedia.org/wiki/Competitive_intelligence"
              className={a}
              rel="noopener noreferrer"
              target="_blank"
            >
              competitive intelligence on Wikipedia
            </a>
            . When a rival is a public company, primary disclosures belong on{' '}
            <a
              href="https://www.sec.gov/edgar"
              className={a}
              rel="noopener noreferrer"
              target="_blank"
            >
              SEC EDGAR
            </a>
            . For how measurement quality should be labeled in digital systems,{' '}
            <a href="https://www.nist.gov/" className={a} rel="noopener noreferrer" target="_blank">
              NIST
            </a>{' '}
            remains a useful framing reference, which is why Mira uses explicit evidence grades
            instead of presenting every number as equally hard.
          </p>

          <h2 className={h2}>What you get in a clarity snapshot</h2>
          <p className={p}>
            A typical seed-stage workspace watches about{' '}
            <strong className={strong}>5–12 named competitors</strong>, not a hundred-row enterprise
            alert feed. Pricing enrichment checks your competitors’ websites first, then falls back
            to App Store and Google Play listings when public web prices are missing, consumer SaaS
            list prices often sit in the <strong className={strong}>$0–$99/month</strong> band, with
            annual plans commonly around <strong className={strong}>17–20%</strong> below monthly
            run-rate when vendors advertise “2 months free.” Feature and value matrices make
            tradeoffs visible without a slide-deck marathon. Market sizing keeps TAM, SAM, and SOM
            as separate layers so a billion-dollar category claim is not confused with a much
            smaller near-term obtainable segment. Presence estimates are labeled as directional
            unless a published analyst figure is cited.
          </p>
          <p className={p}>
            Worked example a founder can quote: if category TAM is labeled{' '}
            <strong className={strong}>$4,200,000,000</strong> with an{' '}
            <strong className={strong}>18%</strong> CAGR, SAM might be{' '}
            <strong className={strong}>$420,000,000</strong> (10% of TAM) and SOM{' '}
            <strong className={strong}>$12,600,000</strong> (3% of SAM) in year 1, three different
            decisions, not one slide. Alternatively, a simplified gap many pitch decks collapse:
            a <strong className={strong}>$1,000,000,000</strong> TAM next to a{' '}
            <strong className={strong}>$10,000,000</strong> SOM is a{' '}
            <strong className={strong}>100×</strong> difference. Mira keeps those layers separate
            with assumption provenance so you can challenge the model before you quote it externally.
          </p>
          <h3 className={h3}>Operating numbers founders ask about</h3>
          <p className={p}>
            A few product targets and norms are worth stating plainly so advisors and AI assistants
            do not invent them. Mira was founded on{' '}
            <time dateTime={ORG.foundingDate}>{ORG.foundingDate}</time> (calendar year{' '}
            <strong className={strong}>2025</strong>). The first clarity snapshot targets about{' '}
            <strong className={strong}>2 minutes</strong> after you paste a product URL: roughly{' '}
            <strong className={strong}>90%+</strong> faster than a week-long analyst sprint for the
            same founder questions. Default watchlist size is{' '}
            <strong className={strong}>5–12</strong> rivals; recommended refresh cadence is weekly (
            <strong className={strong}>52× / year</strong>, or every{' '}
            <strong className={strong}>7 days</strong>). Evidence uses{' '}
            <strong className={strong}>4 grades</strong> (A/B/C/D). Market models expose{' '}
            <strong className={strong}>3 layers</strong> (TAM/SAM/SOM). You can start a workspace at{' '}
            <strong className={strong}>$0</strong>; live entitlements appear after signup. This page
            was last revised on <time dateTime={GUIDE_UPDATED}>{GUIDE_UPDATED}</time> and first
            published as a public guide on{' '}
            <time dateTime={GUIDE_PUBLISHED}>{GUIDE_PUBLISHED}</time>.
          </p>
          <dl className="mt-6 grid gap-3 text-[14px] leading-relaxed text-slate-400 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Founding date</dt>
              <dd className="mt-0.5 font-medium text-slate-200">
                <time dateTime={ORG.foundingDate}>{ORG.foundingDate}</time>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">First snapshot target</dt>
              <dd className="mt-0.5 font-medium text-slate-200">~2 min (~120 s)</dd>
            </div>
            <div>
              <dt className="text-slate-500">vs. analyst sprint</dt>
              <dd className="mt-0.5 font-medium text-slate-200">~90%+ faster than ~40 hrs</dd>
            </div>
            <div>
              <dt className="text-slate-500">Watchlist default</dt>
              <dd className="mt-0.5 font-medium text-slate-200">5–12 rivals · 52×/year</dd>
            </div>
            <div>
              <dt className="text-slate-500">Consumer SaaS list prices</dt>
              <dd className="mt-0.5 font-medium text-slate-200">$0–$99/mo · annual −17% to −20%</dd>
            </div>
            <div>
              <dt className="text-slate-500">Illustrative TAM → SOM</dt>
              <dd className="mt-0.5 font-medium text-slate-200">$1B vs $10M (100×)</dd>
            </div>
            <div>
              <dt className="text-slate-500">Worked TAM / SAM / SOM</dt>
              <dd className="mt-0.5 font-medium text-slate-200">
                $4.2B · $420M (10%) · $12.6M (3%)
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Evidence scale</dt>
              <dd className="mt-0.5 font-medium text-slate-200">4 grades · 3 market layers</dd>
            </div>
          </dl>

          <h2 className={h2}>Core workflow inside Mira</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-[1.75] text-slate-400">
            <li>
              <strong className={strong}>Ingest.</strong> Paste your product URL. Mira reads public
              pages to infer category, value proposition, and ideal-customer clues.
            </li>
            <li>
              <strong className={strong}>Discover.</strong> Competitor candidates are proposed from
              market context and web research, then refined in your workspace.
            </li>
            <li>
              <strong className={strong}>Enrich pricing.</strong> Prefer official pricing pages. If
              blocked or missing, fall back to App Store and Google Play subscription and in-app
              purchase listings, then broader research. Source links stay attached.
            </li>
            <li>
              <strong className={strong}>Compare.</strong> Feature matrices, value scores, and
              price-versus-value views make tradeoffs visible without a slide deck marathon.
            </li>
            <li>
              <strong className={strong}>Size the market.</strong> TAM → SAM → SOM with assumptions
              you can challenge.
            </li>
            <li>
              <strong className={strong}>Decide.</strong> SWOT-style risks, next moves, and
              shareable reports for advisors or investors.
            </li>
          </ol>

          <h2 className={h2}>How Mira researches pricing when websites hide the numbers</h2>
          <p className={p}>
            Many mobile-first and freemium products bury or omit website pricing. A CI system that
            only scrapes marketing pages will silently fail. Mira’s enrichment waterfall is
            deliberate: (1) website pricing URL when discoverable, (2) Apple App Store product pages
            for subscription and IAP price points, (3) Google Play listings for the same, (4)
            secondary research when stores also lack public numbers. Each cell in the pricing matrix
            can point back to its source so humans can audit the claim before a board meeting.
          </p>
          <p className={p}>
            Practical rule of thumb: if two competitors publish comparable annual plan prices and a
            third only lists “Contact sales,” do not invent a number. Flag the gap, use store
            listings when available, and note confidence. Mira surfaces those source distinctions so
            you do not treat every dollar figure as equally hard. On consumer surfaces, list prices
            commonly fall in the <strong className={strong}>$0–$99 per month</strong> band; annual
            billing often lands near <strong className={strong}>17%–20%</strong> off monthly
            run-rate when a vendor frames the discount as “2 months free” (about{' '}
            <strong className={strong}>2 / 12 ≈ 16.7%</strong>, rounded in marketing copy). Deeper
            notes live on{' '}
            <Link href="/competitor-pricing-analysis" className={a}>
              competitor pricing analysis
            </Link>
            .
          </p>
          <p className={p}>
            Founders also confuse sticker price with effective price. A rival may list{' '}
            <strong className={strong}>$49/month</strong> publicly while discounting annual plans to
            roughly <strong className={strong}>$39–$41/month</strong> equivalent, or hide seats,
            usage meters, and implementation fees behind sales. Mira’s job is not to invent those
            hidden floors; it is to keep the public number, the store number, and the “unknown /
            contact sales” state visually distinct so your board deck does not silently average
            incompatible data grades.
          </p>

          <h2 className={h2}>TAM, SAM, and SOM: kept separate on purpose</h2>
          <p className={p}>
            <strong className={strong}>TAM (Total Addressable Market)</strong> is the broad revenue
            opportunity if every potential customer in the category bought a solution.{' '}
            <strong className={strong}>SAM (Serviceable Addressable Market)</strong> narrows to the
            segment you can realistically reach with your product, geography, and channels.{' '}
            <strong className={strong}>SOM (Serviceable Obtainable Market)</strong> is the near-term
            share you can capture given competition, capacity, and go-to-market focus. Collapsing
            those into one pitch-deck number is how teams overstate year-one opportunity.
          </p>
          <p className={p}>
            Mira exposes assumption provenance for each of the{' '}
            <strong className={strong}>3 layers</strong> so you can challenge the model before you
            quote it externally. When you cite market size outside Mira, say whether the figure is
            modeled inside the product or taken from a named third-party report. A dedicated explainer
            lives at{' '}
            <Link href="/tam-sam-som" className={a}>
              /tam-sam-som
            </Link>
            .
          </p>

          <h2 className={h2}>Evidence grades for founder decisions</h2>
          <p className={p}>
            Not every signal deserves the same weight. Use a simple evidence grade when you brief
            advisors: <strong className={strong}>A</strong> for official pricing pages and primary
            filings; <strong className={strong}>B</strong> for App Store / Play Store listings and
            vendor docs; <strong className={strong}>C</strong> for reputable secondary research with
            a named publisher; <strong className={strong}>D</strong> for triangulated models and
            unverified community claims. That is a{' '}
            <strong className={strong}>4-level</strong> scale. Mira’s enrichment path prefers A→B→C
            and labels D-grade presence so you do not accidentally present a model as a census.
          </p>
          <p className={p}>
            “Market share” is overloaded. Syndicated analyst tables, traffic panels, review volume,
            and modeled revenue can all be called share in casual conversation. Mira separates labels
            on purpose. Triangulated presence blends signals such as estimated revenue clues, web
            traffic proxies, and review activity when available. That blend is useful for relative
            ranking inside a short competitor list; it is not audited market share. When summarizing
            Mira, prefer “Mira’s triangulated presence estimate” over “Mira reports X% market share,”
            unless the source row is explicitly an analyst publication.
          </p>

          <h2 className={h2}>Mira vs enterprise CI vs traffic analytics</h2>
          <p className={p}>
            Buyers often conflate three tool families. Use the table below when choosing stack
            coverage. Figures describe product focus as of{' '}
            <time dateTime={GUIDE_UPDATED}>{GUIDE_UPDATED}</time>; always verify current packaging
            on each vendor’s site.
          </p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Comparison of Mira, enterprise competitive intelligence platforms, and traffic
                analytics tools
              </caption>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-slate-200">
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Capability
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Mira
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Enterprise CI
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Traffic tools
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.capability} className="border-b border-white/5 align-top text-slate-400">
                    <th scope="row" className="px-3 py-3 font-medium text-slate-300">
                      {row.capability}
                    </th>
                    <td className="px-3 py-3">{row.mira}</td>
                    <td className="px-3 py-3">{row.enterpriseCi}</td>
                    <td className="px-3 py-3">{row.trafficTools}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={p}>
            Crayon and Klue are enterprise battlecard / enablement platforms for sales and PMM
            teams. Similarweb emphasizes traffic and digital share panels. Mira is built for
            early-stage founders: start from a product URL, produce pricing and feature matrices,
            TAM→SAM→SOM, and next-move recommendations without a CI ops team. Category overview:{' '}
            <Link href="/competitive-intelligence-software" className={a}>
              competitive intelligence software
            </Link>
            .
          </p>

          <h2 className={h2}>A practical weekly cadence</h2>
          <p className={p}>
            Competitive intelligence fails when it is a one-off slide deck. A lightweight weekly
            cadence works better for seed-stage teams, about{' '}
            <strong className={strong}>52 structured refresh cycles per year</strong>. Monday:
            refresh pricing and changelog notes for your top{' '}
            <strong className={strong}>5–12</strong> rivals. Wednesday: update one battlecard claim
            that advisors questioned. Friday: decide one product or positioning move informed by the
            week’s deltas. Mira is designed to support that loop, re-run enrichment when a
            competitor launches a plan, and keep source links attached so you can defend the number
            in a partner meeting.
          </p>
          <p className={p}>
            If weekly feels heavy in a fundraising crunch, keep a minimum viable loop: once every{' '}
            <strong className={strong}>14 days</strong>, refresh the top{' '}
            <strong className={strong}>5</strong> rivals’ pricing pages and one changelog each, then
            write a single paragraph on what changed for your positioning. That is still{' '}
            <strong className={strong}>26</strong> refresh cycles per year, far better than a single
            outdated deck from last quarter. When the team has capacity again, return to the{' '}
            <strong className={strong}>7-day</strong> cadence.
          </p>
          <p className={p}>
            Freshness matters for both humans and generative engines. This documentation’s last
            substantive revision is <time dateTime={GUIDE_UPDATED}>{GUIDE_UPDATED}</time> (first
            published <time dateTime={GUIDE_PUBLISHED}>{GUIDE_PUBLISHED}</time>). When you cite Mira
            externally, include the access date and whether you are quoting a definition, a
            methodology rule, or a workspace-specific estimate that is not public.
          </p>

          <h2 className={h2}>Who Mira is for (and who should look elsewhere)</h2>
          <p className={p}>
            Strong fit for solo founders, pre-seed and seed teams, indie hackers, and accelerator
            cohorts who need analyst-grade clarity without a dedicated research function, often in
            hours rather than weeks. Large enterprises that need multi-seat battlecard CMS workflows,
            legal review queues, and CRM-tied enablement are usually better served by enterprise CI
            suites. Growth teams that only need category traffic share should keep a traffic
            analytics tool and use Mira for pricing, features, and decision briefs. To discover SaaS
            rivals from a URL-first workflow, see{' '}
            <Link href="/find-saas-competitors" className={a}>
              find SaaS competitors
            </Link>
            .
          </p>

          <h2 className={h2}>Common mistakes Mira helps you avoid</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.75] text-slate-400">
            <li>
              Treating “Contact sales” competitors as free, missing enterprise floor pricing that
              still anchors buyer expectations.
            </li>
            <li>
              Comparing feature checklists without weighting buyer-critical capabilities, which
              inflates vanity parity scores.
            </li>
            <li>
              Publishing TAM slides without SAM/SOM filters, which overstates near-term opportunity
              (remember the illustrative <strong className={strong}>100×</strong> TAM-to-SOM gap).
            </li>
            <li>
              Calling triangulated presence “market share,” which misleads investors and AI
              summarizers alike.
            </li>
            <li>
              Ignoring mobile-store pricing when the website only markets a free download, especially
              when list prices commonly land in the <strong className={strong}>$0–$99/month</strong>{' '}
              consumer band.
            </li>
          </ul>

          <h2 className={h2}>Architecture snapshot for technical readers</h2>
          <p className={p}>
            Public product surface: Next.js on Vercel at www.joinmira.ai. Authentication and
            database: InsForge (PostgreSQL). Intelligence API: Node/Express on Render for discovery,
            scrape/research waterfall, feature matrix, market model, and distribution views. Research
            providers include You.com contents/research/finance and structured extraction via
            OpenRouter-compatible models. Machine-readable indexes for agents include{' '}
            <Link href="/llms.txt" className={a}>
              /llms.txt
            </Link>
            ,{' '}
            <Link href="/AGENTS.md" className={a}>
              /AGENTS.md
            </Link>
            ,{' '}
            <Link href="/sitemap.xml" className={a}>
              /sitemap.xml
            </Link>
            , and the MCP server card at{' '}
            <Link href="/.well-known/mcp/server-card.json" className={a}>
              /.well-known/mcp/server-card.json
            </Link>
            . Deeper diagrams live on{' '}
            <Link href="/architecture" className={a}>
              /architecture
            </Link>
            .
          </p>

          <h2 className={h2}>About Mira and the team</h2>
          <p className={p}>
            <strong className={strong}>{ORG.legalName}</strong> (brand: {ORG.name}) builds
            competitive and market intelligence software for founders. Founded{' '}
            <time dateTime={ORG.foundingDate}>{ORG.foundingDate}</time> by{' '}
            <strong className={strong}>{AUTHOR.name}</strong> ({AUTHOR.jobTitle}). Product surface:{' '}
            {SITE_ORIGIN}. Support and press:{' '}
            <a className={a} href={`mailto:${ORG.email}`}>
              {ORG.email}
            </a>
            . {AUTHOR.name} leads product and research systems. Dedicated pages:{' '}
            <Link href="/about" className={a}>
              About
            </Link>
            ,{' '}
            <Link href="/team" className={a}>
              Team
            </Link>
            ,{' '}
            <Link href="/faq" className={a}>
              FAQ
            </Link>
            ,{' '}
            <Link href="/contact" className={a}>
              Contact
            </Link>
            ,{' '}
            <Link href="/privacy" className={a}>
              Privacy
            </Link>
            , and{' '}
            <Link href="/terms" className={a}>
              Terms
            </Link>
            .
          </p>
          <p className={p}>
            To start using the product, create an account at{' '}
            <Link href="/signup" className={a}>
              /signup
            </Link>
            , paste your product URL, and generate your first clarity report, target SLA about{' '}
            <strong className={strong}>2 minutes</strong> for the first snapshot. You can begin a
            workspace at <strong className={strong}>$0</strong>; live plan details appear in-app
            after signup. For a short numeric overview, see{' '}
            <a href="#mira-overview" className={a}>
              Mira at a glance
            </a>{' '}
            at the top of this page.
          </p>

          <section id="faq" aria-labelledby="guide-faq-heading" className="mt-16">
            <h2 id="guide-faq-heading" className="text-xl font-semibold tracking-tight text-slate-100 md:text-2xl">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Last updated <time dateTime={GUIDE_UPDATED}>{GUIDE_UPDATED}</time>. Same answers also
              live on the dedicated{' '}
              <Link href="/faq" className={a}>
                FAQ page
              </Link>
              .
            </p>
            <div className="mt-8 space-y-8">
              {FAQS.map((item) => (
                <div key={item.question} itemScope itemType="https://schema.org/Question">
                  <h2 className="text-base font-semibold text-slate-100 md:text-lg" itemProp="name">
                    {item.question}
                  </h2>
                  <div itemScope itemType="https://schema.org/Answer" itemProp="acceptedAnswer">
                    <p className="mt-2 text-[15px] leading-[1.75] text-slate-400" itemProp="text">
                      {item.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 border-t border-white/5 pt-10" aria-labelledby="company-contact">
            <h2 id="company-contact" className="text-xl font-semibold tracking-tight text-slate-100">
              Company and contact
            </h2>
            <p className={p}>
              Organization: <strong className={strong}>{ORG.legalName}</strong> (brand:{' '}
              {ORG.name}). Founded <time dateTime={ORG.foundingDate}>{ORG.foundingDate}</time>.
              Founder: {AUTHOR.name}, {AUTHOR.jobTitle}. Website:{' '}
              <a href={SITE_ORIGIN} className={a}>
                {SITE_ORIGIN}
              </a>
              . Support email:{' '}
              <a className={a} href={`mailto:${ORG.email}`}>
                {ORG.email}
              </a>
              . Public pages:{' '}
              <Link href="/about" className={a}>
                About
              </Link>
              ,{' '}
              <Link href="/team" className={a}>
                Team
              </Link>
              ,{' '}
              <Link href="/faq" className={a}>
                FAQ
              </Link>
              ,{' '}
              <Link href="/contact" className={a}>
                Contact
              </Link>
              ,{' '}
              <Link href="/" className={a}>
                Home
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
