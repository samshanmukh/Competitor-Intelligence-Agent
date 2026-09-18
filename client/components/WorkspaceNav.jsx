'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandLogo from './BrandLogo';
import { Icon } from './ui';

const ITEMS = [
  { href: '/app', label: 'Analysis', icon: 'sparkle', exact: true },
];

export default function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <header className="glass-nav sticky top-0 z-40 shrink-0 border-b">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
        <BrandLogo href="/app" height={25} />
        <nav aria-label="Workspace navigation" className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
          {ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-white/[0.1] text-white ring-1 ring-white/10'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4 opacity-80" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
