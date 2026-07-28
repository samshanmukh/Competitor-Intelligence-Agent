import Link from 'next/link';

/**
 * Short, human-readable product documentation for the homepage.
 * Written like real docs (not a citation dump). Keeps enough structure and
 * numbers for GEO scanners while staying tasteful below the marketing CTA.
 * Full cornerstone lives on /guide.
 */
export default function LandingProductDocs() {
  return (
    <section
      id="how-mira-works"
      aria-label="How Mira works"
      className="border-t border-white/5 bg-ink-950/60"
    >
      <div className="mx-auto max-w-3xl px-5 py-14 md:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          Product overview
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          How Mira works for founders
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
          Mira is competitive and market intelligence software for early-stage teams.
          Paste a product URL and Mira aims to return a first clarity snapshot in about
          two minutes: who you compete with, what they charge, how the market layers
          (TAM → SAM → SOM), and which moves matter next. Founded{' '}
          <time dateTime="2025-01-15">2025-01-15</time> by{' '}
          <Link href="/about" className="text-slate-300 underline-offset-2 hover:underline">
            Sam Karri
          </Link>
          . Support:{' '}
          <a
            href="mailto:support@joinmira.ai"
            className="text-slate-300 underline-offset-2 hover:underline"
          >
            support@joinmira.ai
          </a>
          .
        </p>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">
          What you get in a clarity snapshot
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          A typical seed-stage workspace watches about 5–12 named competitors, not a
          hundred-row enterprise alert feed. Pricing enrichment checks your competitors’
          websites first, then falls back to App Store and Google Play listings when
          public web prices are missing — consumer SaaS list prices often sit in the
          $0–$99/month band, with annual plans commonly around 17–20% below monthly
          run-rate. Feature and value matrices make tradeoffs visible without a slide-deck
          marathon. Market sizing keeps TAM, SAM, and SOM as separate layers so a
          billion-dollar category claim is not confused with a much smaller near-term
          obtainable segment. Presence estimates are labeled as directional unless a
          published analyst figure is cited.
        </p>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">
          TAM, SAM, and SOM — kept separate on purpose
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          <strong className="font-medium text-slate-300">TAM</strong> is the broad
          revenue opportunity if every potential customer in the category bought.{' '}
          <strong className="font-medium text-slate-300">SAM</strong> narrows to the
          segment you can realistically reach with your product, geography, and channels.{' '}
          <strong className="font-medium text-slate-300">SOM</strong> is the near-term
          share you can capture given competition and capacity. Collapsing those into one
          pitch-deck number is how teams overstate year-one opportunity. Mira exposes
          assumption provenance for each layer so you can challenge the model before you
          quote it externally.
        </p>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">
          A practical weekly cadence
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          Competitive intelligence works best as a habit. Many seed teams refresh weekly
          (about 52 cycles per year): review pricing and changelog deltas for the top
          rivals, update one claim that advisors questioned, then pick one product or
          positioning move. Mira is built for that loop — re-run enrichment when a
          competitor launches a plan, and keep source links attached so you can defend
          the number in a partner meeting.
        </p>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">
          Who Mira is for
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          Strong fit for solo founders, pre-seed and seed teams, indie hackers, and
          accelerator cohorts who need analyst-grade clarity without a dedicated research
          function. Large enterprises that need multi-seat battlecard CMS workflows and
          CRM-tied enablement are usually better served by enterprise CI suites. Growth
          teams that only need category traffic share should keep a traffic analytics
          tool and use Mira for pricing, features, and decision briefs.
        </p>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">
          Evidence, not theater
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          Signals are graded so hard facts stay distinct from models: A for official
          pricing pages, B for store listings, C for named secondary research, and D for
          triangulated estimates. That grading shows up in matrices and briefs so a
          D-grade presence figure is never presented as audited market share. Deeper
          methodology notes live on the{' '}
          <Link href="/methodology" className="text-slate-300 underline-offset-2 hover:underline">
            methodology page
          </Link>
          .
        </p>

        <p className="mt-10 text-[15px] leading-relaxed text-slate-400">
          Want the longer reference — definitions, comparison table, and FAQ? Read the{' '}
          <Link href="/guide" className="text-slate-200 underline-offset-2 hover:underline">
            competitive intelligence guide
          </Link>
          , or jump to the{' '}
          <Link href="/faq" className="text-slate-200 underline-offset-2 hover:underline">
            FAQ
          </Link>
          ,{' '}
          <Link href="/about" className="text-slate-200 underline-offset-2 hover:underline">
            About
          </Link>
          , and{' '}
          <Link href="/team" className="text-slate-200 underline-offset-2 hover:underline">
            Team
          </Link>{' '}
          pages.
        </p>
      </div>
    </section>
  );
}
