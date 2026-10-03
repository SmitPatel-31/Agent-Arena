import type { Racer } from '@/lib/types';

export const racerColor: Record<Racer, { text: string; bg: string; soft: string; border: string }> = {
  A: { text: 'text-racer-a', bg: 'bg-racer-a', soft: 'bg-racer-a-soft', border: 'border-racer-a' },
  B: { text: 'text-racer-b', bg: 'bg-racer-b', soft: 'bg-racer-b-soft', border: 'border-racer-b' },
};

export function RacerBadge({ racer, size = 'sm' }: { racer: Racer; size?: 'sm' | 'lg' }) {
  const dims = size === 'lg' ? 'h-8 w-8 text-sm' : 'h-5 w-5 text-[11px]';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md font-display font-bold text-white ${dims} ${racerColor[racer].bg}`}>
      {racer}
    </span>
  );
}
