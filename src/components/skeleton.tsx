/** Shimmering placeholder block for loading states. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${className}`} aria-hidden>
      <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-surface to-transparent opacity-70" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-8 h-10 w-56" />
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
