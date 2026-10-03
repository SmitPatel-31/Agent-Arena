import { decideWinner } from '@/lib/score';
import type { RaceSummary, RunSummary } from '@/lib/types';
import { RacerBadge, racerColor } from '../racer-badge';
import { formatDuration, formatTokens } from './format';

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
    label: 'Tokens (in / out)',
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

  return (
    <section aria-label="Scorecard" className="animate-rise-in overflow-hidden rounded-2xl border border-border bg-surface">
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${winner ? racerColor[winner].soft : 'bg-surface-2'}`}>
        {winner ? (
          <>
            <TrophyIcon className={racerColor[winner].text} />
            <div>
              <div className="text-lg font-semibold">
                Racer {winner} wins: {modelLabel(race.runs[winner].model)}
              </div>
              <div className="text-sm text-muted">{reason}</div>
            </div>
          </>
        ) : (
          <div>
            <div className="text-lg font-semibold">No winner</div>
            <div className="text-sm text-muted">{reason}</div>
          </div>
        )}
        {interrupted && <span className="ml-auto rounded-md bg-warn-soft px-2 py-1 text-xs text-warn">This race was interrupted before both runs finished.</span>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-5 py-2 font-medium">Metric</th>
            {(['A', 'B'] as const).map((r) => (
              <th key={r} className="px-5 py-2 font-medium">
                <span className="flex items-center gap-2">
                  <RacerBadge racer={r} /> <span className="truncate">{modelLabel(race.runs[r].model)}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const comparable = m.rank && (!m.needsBothVerified || bothVerified);
            const a = comparable ? m.rank!(A) : 0;
            const b = comparable ? m.rank!(B) : 0;
            const leader = !comparable || a === b ? null : a < b ? 'A' : 'B';
            return (
              <tr key={m.label} className="border-b border-border last:border-0">
                <td className="px-5 py-2.5 text-muted">{m.label}</td>
                {([A, B] as const).map((run) => (
                  <td key={run.racer} className={`px-5 py-2.5 font-mono tabular-nums ${leader === run.racer ? 'font-semibold text-fg' : ''}`}>
                    {m.value(run)}
                    {leader === run.racer && <span className="ml-1.5 text-ok">●</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-9 w-9 ${className ?? ''}`}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}
