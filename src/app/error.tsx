'use client';

import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="animate-rise-in mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-err-soft font-display text-xl font-bold text-err" aria-hidden>
        !
      </span>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Red flag</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Something stopped the race</h1>
      <p className="mt-3 text-muted">
        {error.message.includes('Missing environment variables')
          ? 'The server is missing configuration. Check .env.local against .env.example.'
          : 'An unexpected error interrupted this page. Your races are safe in the database.'}
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">ref {error.digest}</p>}
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="rounded-xl bg-fg px-5 py-2.5 font-display font-semibold text-bg transition-opacity hover:opacity-90">
          Try again
        </button>
        <Link href="/" className="rounded-xl border border-border px-5 py-2.5 font-display font-semibold transition-colors hover:border-fg">
          Home
        </Link>
      </div>
    </div>
  );
}
