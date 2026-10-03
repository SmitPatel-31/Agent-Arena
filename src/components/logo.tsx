/** Two lanes converging on a checkered finish. */
export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
        <rect x="1" y="1" width="26" height="26" rx="7" className="fill-fg" />
        <rect x="6" y="9" width="11" height="3" rx="1.5" className="fill-racer-a" />
        <rect x="6" y="16" width="11" height="3" rx="1.5" className="fill-racer-b" />
        <g className="fill-bg">
          <rect x="19" y="7" width="3" height="3" />
          <rect x="22" y="10" width="3" height="3" />
          <rect x="19" y="13" width="3" height="3" />
          <rect x="22" y="16" width="3" height="3" />
          <rect x="19" y="19" width="3" height="3" />
        </g>
      </svg>
      {withWordmark && <span className="font-display text-[17px] font-bold tracking-tight">Agent Arena</span>}
    </span>
  );
}
