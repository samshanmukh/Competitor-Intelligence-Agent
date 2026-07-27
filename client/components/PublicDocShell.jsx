import Link from 'next/link';
import BrandLogo from './BrandLogo';

const FOOTER_LINKS = [
  { href: '/guide', label: 'Guide' },
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Team' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/signup', label: 'Create account' },
];

export default function PublicDocShell({ title, children, updated }) {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-300">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <BrandLogo href="/" height={28} />
          <nav className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/faq" className="hover:text-white">FAQ</Link>
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/signup" className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-ink-950 hover:bg-slate-200">
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h1>
        {updated ? (
          <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>
        ) : null}
        <div className="prose-mira mt-8 space-y-4 text-[15px] leading-relaxed">{children}</div>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-8 text-sm text-slate-500">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-slate-300">
              {l.label}
            </Link>
          ))}
          <span className="text-xs text-slate-600">© {new Date().getFullYear()} Mira</span>
        </div>
      </footer>
    </div>
  );
}
