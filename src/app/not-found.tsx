import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="animate-rise-in mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="checker mb-8 h-10 w-16 rounded-sm opacity-90" aria-hidden />
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">404 · Off the track</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">This lane doesn&apos;t exist</h1>
      <p className="mt-3 text-muted">The race or page you were looking for isn&apos;t here. It may have been mistyped or never run.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-xl bg-fg px-5 py-2.5 font-display font-semibold text-bg transition-opacity hover:opacity-90">
          Start a race
        </Link>
        <Link href="/history" className="rounded-xl border border-border px-5 py-2.5 font-display font-semibold transition-colors hover:border-fg">
          Race history
        </Link>
      </div>
    </div>
  );
}
