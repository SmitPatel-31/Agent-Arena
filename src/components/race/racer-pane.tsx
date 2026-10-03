'use client';

import { useEffect, useRef, useState } from 'react';
import type { Phase, RacerState } from '@/lib/race-state';
import type { Racer } from '@/lib/types';
import { RacerBadge, racerColor } from '../racer-badge';
import { formatDuration } from './format';
import { TimelineCard } from './timeline-card';

const MAX_STEPS = 15;

const PHASE_LABEL: Record<Phase, string> = {
  waiting: 'Waiting',
  thinking: 'Thinking',
  calling: 'Calling tool',
  verifying: 'Verifying',
  verified: 'Finished',
};

interface Props {
  racer: Racer;
  modelLabel: string;
  state: RacerState;
  isWinner: boolean;
  /** The agent's own measured duration, once the race is final; replaces the event-based timer. */
  finalDurationMs: number | null;
}

export function RacerPane({ racer, modelLabel, state, isWinner, finalDurationMs }: Props) {
  const color = racerColor[racer];
  const busy = state.phase === 'thinking' || state.phase === 'calling' || state.phase === 'verifying';
  const verdict = state.verification;

  return (
    <section
      aria-label={`Racer ${racer}`}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-surface ${isWinner ? `${color.border} shadow-lg` : 'border-border'}`}
    >
      <header className={`border-b border-border px-4 py-3 ${color.soft}`}>
        <div className="flex items-center gap-3">
          <RacerBadge racer={racer} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{modelLabel}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {busy && <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${color.bg}`} />}
              {verdict ? (
                <span className={verdict.success ? 'font-medium text-ok' : 'font-medium text-err'}>
                  {verdict.success ? 'Verified success' : 'Not verified'}
                </span>
              ) : (
                PHASE_LABEL[state.phase]
              )}
            </div>
          </div>
          <dl className="flex gap-4 text-right">
            <Stat label="Step" value={`${state.step}/${MAX_STEPS}`} />
            <Stat label="Time" value={finalDurationMs !== null ? formatDuration(finalDurationMs) : <Elapsed start={state.startedAt} end={state.finishedAt} />} />
            <Stat label="Errors" value={String(state.toolErrors)} tone={state.toolErrors > 0 ? 'text-err' : undefined} />
          </dl>
        </div>
      </header>
      <Timeline state={state} />
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`font-mono text-sm tabular-nums ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}

function Elapsed({ start, end }: { start: number | null; end: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (start === null || end !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [start, end]);
  if (start === null) return <>0.0s</>;
  return <>{formatDuration(Math.max(0, (end ?? now) - start))}</>;
}

/** Scrolls to the newest card unless the viewer has scrolled up to read something. */
function Timeline({ state }: { state: RacerState }) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [state.timeline]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="flex-1 space-y-2 overflow-y-auto p-3"
    >
      {state.timeline.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{state.phase === 'waiting' ? 'Waiting for the start…' : 'Thinking about the first move…'}</p>
      ) : (
        state.timeline.map((item) => <TimelineCard key={item.key} item={item} />)
      )}
    </div>
  );
}
