'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Race', match: (p: string) => p === '/' || p.startsWith('/race') },
  { href: '/history', label: 'History', match: (p: string) => p.startsWith('/history') },
  { href: '/leaderboard', label: 'Leaderboard', match: (p: string) => p.startsWith('/leaderboard') },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`relative whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
              active ? 'font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            {item.label}
            {active && <span className="absolute inset-x-2.5 -bottom-[11px] h-0.5 rounded-full bg-racer-a" aria-hidden />}
          </Link>
        );
      })}
    </div>
  );
}
