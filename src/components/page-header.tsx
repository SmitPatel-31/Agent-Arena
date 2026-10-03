export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="animate-rise-in mb-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.03em]">{title}</h1>
      {children && <p className="mt-2 max-w-[60ch] text-muted">{children}</p>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="animate-rise-in rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
      <div className="checker mx-auto mb-5 h-6 w-10 rounded-sm opacity-80" aria-hidden />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
