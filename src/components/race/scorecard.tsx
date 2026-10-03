'use client';

import { decideWinner } from '@/lib/score';
import type { RaceSummary, RunSummary } from '@/lib/types';
import { RacerBadge, racerColor } from '../racer-badge';
import { formatDuration, formatTokens } from './format';
import { useCountUp } from './use-now';

interface Metric {
  label: string;
  value: (r: RunSummary) => string;
  /** Lower-is-better number used to highlight the leader; omit for non-comparable rows. */
  rank?: (r: RunSummary) => number;
  /** Efficiency rows only mean something between two verified finishers. */
  needsBothVerified?: boolean;
}

const METRICS: Metric[] = [
  { label: 'Verified success', value: (r) => (r.verifiedSuccess ? 'Yes' : 'No'), rank: (r) => (r.verifiedSuccess ? 0 : 1) },
  { label: 'Total time', needsBothVerified: true, value: (r) => formatDuration(r.durationMs), rank: (r) => r.durationMs ?? Infinity },
  { label: 'Steps', needsBothVerified: true, value: (r) => String(r.steps), rank: (r) => r.steps },
  { label: 'Tool errors', needsBothVerified: true, value: (r) => String(r.toolErrors), rank: (r) => r.toolErrors },
  {
    label: 'Tokens in / out',
    value: (r) => `${formatTokens(r.inputTokens)} / ${formatTokens(r.outputTokens)}`,
    rank: (r) => (r.inputTokens ?? 0) + (r.outputTokens ?? 0),
    needsBothVerified: true,
  },
  { label: 'Ended as', value: (r) => r.status.replace('_', ' ') },
];

export function Scorecard({ race, modelLabel, interrupted }: { race: RaceSummary; modelLabel: (id: string) => string; interrupted: boolean }) {
  const { A, B } = race.runs;
  const { winner, reason } = decideWinner(A, B);
  const bothVerified = A.verifiedSuccess === true && B.verifiedSuccess === true;
  const winnerRun = winner ? race.runs[winner] : null;

  return (
    <section aria-label="Scorecard" className="animate-rise-in overflow-hidden rounded-2xl border border-border bg-surface">
      <div className={`relative overflow-hidden px-5 py-5 sm:px-6 ${winner ? racerColor[winner].soft : 'bg-surface-2'}`}>
        {winner && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 overflow-hidden opacity-[0.12] [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden>
            <div className="checker animate-flag-sweep h-full w-[140%] [background-size:22px_22px]" />
          </div>
        )}
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Result</div>
            {winner && winnerRun ? (
              <h2 className="mt-1 flex items-center gap-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                <RacerBadge racer={winner} size="lg" />
                {modelLabel(winnerRun.model)} wins
              </h2>
            ) : (
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">No winner</h2>
            )}
            <p className="mt-1 text-sm text-muted">{reason}</p>
          </div>
          {winnerRun && winnerRun.durationMs !== null && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Finish time</div>
              <div className={`font-mono text-4xl font-bold tabular-nums ${racerColor[winner!].text}`}>
                <CountUpSeconds ms={winnerRun.durationMs} />
              </div>
            </div>
          )}
        </div>
        {interrupted && (
          <p className="relative mt-3 inline-block rounded-md bg-warn-soft px-2 py-1 text-xs text-warn">This race was interrupted before both runs finished.</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted sm:px-6">Metric</th>
              {(['A', 'B'] as const).map((r) => (
                <th key={r} className="px-5 py-2.5 font-medium sm:px-6">
                  <span className="flex items-center gap-2">
                    <RacerBadge racer={r} /> <span className="truncate">{modelLabel(race.runs[r].model)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m, i) => {
              const comparable = m.rank && (!m.needsBothVerified || bothVerified);
              const a = comparable ? m.rank!(A) : 0;
              const b = comparable ? m.rank!(B) : 0;
              const leader = !comparable || a === b ? null : a < b ? 'A' : 'B';
              return (
                <tr key={m.label} className="animate-card-in border-b border-border last:border-0" style={{ animationDelay: `${200 + i * 70}ms` }}>
                  <td className="px-5 py-2.5 text-muted sm:px-6">{m.label}</td>
                  {([A, B] as const).map((run) => (
                    <td key={run.racer} className={`px-5 py-2.5 font-mono tabular-nums sm:px-6 ${leader === run.racer ? 'font-semibold text-fg' : 'text-fg/80'}`}>
                      <span className="inline-flex items-center gap-2">
                        {m.value(run)}
                        {leader === run.racer && <span className={`h-1.5 w-1.5 rounded-full ${racerColor[run.racer].bg}`} aria-label="leader" />}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CountUpSeconds({ ms }: { ms: number }) {
  const value = useCountUp(ms / 1000, 1100);
  return <>{value.toFixed(1)}s</>;
}
