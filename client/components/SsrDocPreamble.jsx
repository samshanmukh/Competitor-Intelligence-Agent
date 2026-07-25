import Link from 'next/link';

/**
 * Server-rendered text for pages that otherwise mount large client UIs.
 * Keeps GEO / AI crawlers from seeing an empty HTML shell.
 */
export default function SsrDocPreamble({ title, children }) {
  return (
    <section
      aria-label={`${title} summary`}
      className="border-b border-white/10 bg-ink-950 px-5 py-10 text-slate-300"
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
          Public documentation
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed">{children}</div>
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/about" className="text-indigo-300 hover:underline">About</Link>
          {' · '}
          <Link href="/team" className="text-indigo-300 hover:underline">Team</Link>
          {' · '}
          <Link href="/contact" className="text-indigo-300 hover:underline">Contact</Link>
          {' · '}
          <Link href="/faq" className="text-indigo-300 hover:underline">FAQ</Link>
          {' · '}
          <a href="mailto:support@joinmira.ai" className="text-indigo-300 hover:underline">
            support@joinmira.ai
          </a>
        </p>
      </div>
    </section>
  );
}
