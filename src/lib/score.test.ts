import { describe, expect, it } from 'vitest';
import { decideWinner, leaderboard } from './score';
import type { RaceSummary, Racer, RunSummary } from './types';

const run = (racer: Racer, over: Partial<RunSummary> = {}): RunSummary => ({
  id: `run-${racer}`,
  racer,
  model: racer === 'A' ? 'lite' : 'flash',
  status: 'completed',
  verifiedSuccess: true,
  steps: 4,
  toolErrors: 0,
  durationMs: 10_000,
  inputTokens: 1_000,
  outputTokens: 100,
  finalAnswer: 'done',
  ...over,
});

describe('decideWinner', () => {
  it('a verified success beats a faster unverified claim', () => {
    expect(decideWinner(run('A', { verifiedSuccess: false, durationMs: 1 }), run('B'))).toEqual({ winner: 'B', reason: 'Only verified finisher' });
  });

  it('when both succeed, faster wins, then fewer steps', () => {
    expect(decideWinner(run('A', { durationMs: 9_000 }), run('B')).winner).toBe('A');
    expect(decideWinner(run('A'), run('B', { steps: 3 }))).toEqual({ winner: 'B', reason: 'Fewer steps' });
  });

  it('no winner when both fail', () => {
    expect(decideWinner(run('A', { verifiedSuccess: false }), run('B', { verifiedSuccess: null })).winner).toBeNull();
  });
});

describe('leaderboard', () => {
  const race = (A: RunSummary, B: RunSummary): RaceSummary => ({ id: 'r', seq: 1, taskId: 't', createdAt: '', runs: { A, B } });

  it('aggregates win rate and skips unfinished races', () => {
    const rows = leaderboard([
      race(run('A', { durationMs: 5_000 }), run('B')),
      race(run('A', { verifiedSuccess: false, steps: 15 }), run('B')),
      race(run('A', { verifiedSuccess: null }), run('B')),
    ]);
    expect(rows.map((r) => [r.model, r.races, r.wins, r.avgSteps])).toEqual([
      // Equal win rates; flash ranks first on success rate.
      ['flash', 2, 1, 4],
      ['lite', 2, 1, 9.5],
    ]);
  });
});
