import type { Metadata } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { NavLinks } from '@/components/nav-links';
import './globals.css';

const display = Bricolage_Grotesque({ variable: '--font-display', subsets: ['latin'] });
const body = Hanken_Grotesk({ variable: '--font-body', subsets: ['latin'] });
const mono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Agent Arena', template: '%s · Agent Arena' },
  description: 'Two AI models race on the same real-world, multi-app task through Composio tools, with independent verification.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
            <Link href="/" className="shrink-0" aria-label="Agent Arena home">
              <Logo />
            </Link>
            <NavLinks />
            <a
              href="https://github.com/SmitPatel-31/Agent-Arena"
              className="ml-auto hidden rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-fg hover:text-fg sm:block"
            >
              Source
            </a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
