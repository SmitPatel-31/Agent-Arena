'use client';

import type { RaceState, RacerState } from '@/lib/race-state';
import type { Racer } from '@/lib/types';
import { racerColor, RacerBadge } from '../racer-badge';
import { describeTool, formatDuration } from './format';
import { useNow } from './use-now';

/**
 * Both racers on one shared time axis: a line that grows while the agent works and a
 * marker per tool call. It makes "who is ahead" and "where it stalled" readable at a glance.
 */
export function TelemetryStrip({ state, live }: { state: RaceState; live: boolean }) {
  const origin = minDefined(state.A.startedAt, state.B.startedAt);
  const now = useNow(live && origin !== null, 200);

  const endOf = (s: RacerState) => s.finishedAt ?? (live ? now : lastEventAt(s) ?? s.startedAt ?? now);
  const latest = Math.max(endOf(state.A), endOf(state.B));
  // Axis: at least 30s, rounded up to the next 15s so it rescales in calm steps.
  const spanMs = Math.max(30_000, Math.ceil(((latest - (origin ?? latest)) + 1) / 15_000) * 15_000);
  const pct = (t: number) => (origin === null ? 0 : Math.min(100, Math.max(0, ((t - origin) / spanMs) * 100)));
  const ticks = Array.from({ length: Math.floor(spanMs / 15_000) + 1 }, (_, i) => i * 15_000);

  return (
    <section aria-label="Race telemetry" className="rounded-2xl border border-border bg-surface px-4 pb-3 pt-4">
      <div className="space-y-3">
        {(['A', 'B'] as const).map((racer) => (
          <Lane key={racer} racer={racer} state={state[racer]} pct={pct} end={endOf(state[racer])} />
        ))}
      </div>
      <div className="relative ml-8 mt-2 h-4 font-mono text-[10px] text-muted" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / spanMs) * 100}%` }}>
            {t / 1000}s
          </span>
        ))}
      </div>
    </section>
  );
}

function Lane({ racer, state, pct, end }: { racer: Racer; state: RacerState; pct: (t: number) => number; end: number }) {
  const color = racerColor[racer];
  const start = state.startedAt;
  const tools = state.timeline.filter((t) => t.kind === 'tool');
  const finished = state.finishedAt !== null;
  const verdict = state.verification;

  return (
    <div className="flex items-center gap-3">
      <RacerBadge racer={racer} />
      <div className="relative h-7 flex-1">
        {/* track */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-border" />
        {start !== null && (
          <div
            className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${color.bg} transition-[width] duration-200 ease-linear`}
            style={{ left: `${pct(start)}%`, width: `${Math.max(0.5, pct(end) - pct(start))}%` }}
          />
        )}
        {tools.map((t) => {
          const status = !t.result ? 'running' : t.result.success ? 'ok' : 'error';
          const { toolkit, action } = describeTool(t.tool);
          return (
            <span
              key={t.key}
              title={`${toolkit}: ${action}${t.result ? ` · ${formatDuration(t.result.durationMs)}` : ' · running'}`}
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface transition-colors ${
                status === 'ok' ? 'bg-ok' : status === 'error' ? 'bg-err' : `${color.bg} animate-pulse-ring ${color.text}`
              }`}
              style={{ left: `${pct(t.at)}%` }}
            />
          );
        })}
        {finished && (
          <span
            className="animate-card-in absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-surface text-xs shadow-sm"
            style={{ left: `${pct(end)}%` }}
            title={verdict ? (verdict.success ? 'Verified' : 'Not verified') : 'Verifying'}
          >
            {verdict ? <span className={verdict.success ? 'text-ok' : 'text-err'}>{verdict.success ? '✓' : '✗'}</span> : <span className="checker block h-3 w-3 rounded-[2px]" />}
          </span>
        )}
      </div>
    </div>
  );
}

function lastEventAt(s: RacerState): number | null {
  const last = s.timeline[s.timeline.length - 1];
  return last ? last.at : null;
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}
