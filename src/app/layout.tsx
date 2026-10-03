import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agent Arena',
  description: 'Two AI models race on the same real-world, multi-app task through Composio tools, with independent verification.',
};

const NAV = [
  { href: '/', label: 'New race' },
  { href: '/history', label: 'History' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
              <span aria-hidden className="flex gap-0.5">
                <span className="h-4 w-1.5 rounded-sm bg-racer-a" />
                <span className="h-4 w-1.5 rounded-sm bg-racer-b" />
              </span>
              Agent Arena
            </Link>
            <div className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg">
                  {item.label}
                </Link>
              ))}
            </div>
            <span className="ml-auto hidden text-xs text-muted sm:block">Composio tools · Gemini racers</span>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
