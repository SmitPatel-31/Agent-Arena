import type { RaceSummary, Racer, RunSummary } from './types';

export interface Verdict {
  winner: Racer | null;
  reason: string;
}

/**
 * Winner rules, in order:
 *   1. Only a verified success can win. Claiming success counts for nothing.
 *   2. If both succeeded, it is a race: less wall-clock time wins.
 *   3. Exact time ties fall back to fewer steps, then fewer tokens.
 */
export function decideWinner(a: RunSummary, b: RunSummary): Verdict {
  const okA = a.verifiedSuccess === true;
  const okB = b.verifiedSuccess === true;
  if (!okA && !okB) return { winner: null, reason: 'Neither racer completed the task' };
  if (okA !== okB) return { winner: okA ? 'A' : 'B', reason: 'Only verified finisher' };

  const tiebreakers: [string, (r: RunSummary) => number][] = [
    ['Faster', (r) => r.durationMs ?? Infinity],
    ['Fewer steps', (r) => r.steps],
    ['Fewer tokens', (r) => (r.inputTokens ?? 0) + (r.outputTokens ?? 0)],
  ];
  for (const [reason, metric] of tiebreakers) {
    const diff = metric(a) - metric(b);
    if (diff !== 0) return { winner: diff < 0 ? 'A' : 'B', reason };
  }
  return { winner: null, reason: 'Dead heat' };
}

export interface LeaderboardRow {
  model: string;
  races: number;
  wins: number;
  winRate: number;
  successRate: number;
  avgSteps: number;
  avgDurationMs: number;
}

/** Aggregates finished races per model. Mirror matches (same model both sides) count once per run. */
export function leaderboard(races: RaceSummary[]): LeaderboardRow[] {
  const rows = new Map<string, { races: number; wins: number; successes: number; steps: number; duration: number }>();

  for (const race of races) {
    const { A, B } = race.runs;
    if (A.verifiedSuccess === null || B.verifiedSuccess === null) continue;
    const { winner } = decideWinner(A, B);
    for (const run of [A, B]) {
      const row = rows.get(run.model) ?? { races: 0, wins: 0, successes: 0, steps: 0, duration: 0 };
      row.races++;
      if (winner === run.racer) row.wins++;
      if (run.verifiedSuccess) row.successes++;
      row.steps += run.steps;
      row.duration += run.durationMs ?? 0;
      rows.set(run.model, row);
    }
  }

  return [...rows.entries()]
    .map(([model, r]) => ({
      model,
      races: r.races,
      wins: r.wins,
      winRate: r.wins / r.races,
      successRate: r.successes / r.races,
      avgSteps: r.steps / r.races,
      avgDurationMs: r.duration / r.races,
    }))
    .sort((x, y) => y.winRate - x.winRate || y.successRate - x.successRate || x.avgSteps - y.avgSteps);
}
