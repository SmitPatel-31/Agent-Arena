'use client';

import { useEffect, useRef } from 'react';
import type { Phase, RacerState } from '@/lib/race-state';
import type { Racer } from '@/lib/types';
import { racerColor } from '../racer-badge';
import { formatDuration } from './format';
import { TimelineCard } from './timeline-card';
import { useNow } from './use-now';

const MAX_STEPS = 15;

const PHASE: Record<Phase, { label: string; tone: string }> = {
  waiting: { label: 'On the grid', tone: 'text-muted' },
  thinking: { label: 'Thinking', tone: 'text-fg' },
  calling: { label: 'Calling a tool', tone: 'text-fg' },
  verifying: { label: 'Verifying result', tone: 'text-warn' },
  verified: { label: 'Finished', tone: 'text-muted' },
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
  const phase = PHASE[state.phase];

  return (
    <section
      aria-label={`Lane ${racer}: ${modelLabel}`}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-surface transition-shadow duration-500 ${
        isWinner ? `${color.border} shadow-[0_0_0_1px_currentColor,0_20px_40px_-20px_currentColor] ${color.text}` : 'border-border'
      }`}
    >
      <div className={`h-1 shrink-0 ${color.bg}`} aria-hidden />
      <header className="border-b border-border px-4 pb-3 pt-3.5 text-fg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${color.text}`}>Lane {racer}</div>
            <div className="truncate font-display text-lg font-bold tracking-tight">{modelLabel}</div>
          </div>
          <StatusChip busy={busy} dot={color.bg} verdict={verdict?.success ?? null} label={phase.label} tone={phase.tone} />
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Step</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums">
              {state.step}
              <span className="text-sm text-muted">/{MAX_STEPS}</span>
            </dd>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${color.bg} transition-[width] duration-500`} style={{ width: `${(state.step / MAX_STEPS) * 100}%` }} />
            </div>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Time</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums">
              {finalDurationMs !== null ? formatDuration(finalDurationMs) : <Elapsed start={state.startedAt} end={state.finishedAt} />}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">Tool errors</dt>
            <dd className={`font-mono text-xl font-semibold tabular-nums ${state.toolErrors > 0 ? 'text-err' : ''}`}>
              {state.toolErrors}
              <span className="text-sm text-muted">/{state.toolCalls}</span>
            </dd>
          </div>
        </dl>
      </header>
      <Timeline state={state} />
    </section>
  );
}

function StatusChip({ busy, dot, verdict, label, tone }: { busy: boolean; dot: string; verdict: boolean | null; label: string; tone: string }) {
  if (verdict !== null) {
    return (
      <span
        className={`animate-card-in shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${verdict ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'}`}
      >
        {verdict ? '✓ Verified' : '✗ Not verified'}
      </span>
    );
  }
  return (
    <span className={`flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${busy ? `${dot} animate-pulse` : 'bg-muted'}`} />
      {label}
    </span>
  );
}

function Elapsed({ start, end }: { start: number | null; end: number | null }) {
  const now = useNow(start !== null && end === null);
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
      className="flex-1 space-y-2 overflow-y-auto bg-bg/40 p-3 text-fg"
    >
      {state.timeline.length === 0 ? (
        <div className="space-y-2 py-2" aria-label="Waiting for the first move">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative h-14 overflow-hidden rounded-lg border border-border bg-surface" style={{ opacity: 1 - i * 0.3 }}>
              <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-surface-2 to-transparent" />
            </div>
          ))}
        </div>
      ) : (
        state.timeline.map((item) => <TimelineCard key={item.key} item={item} />)
      )}
    </div>
  );
}
