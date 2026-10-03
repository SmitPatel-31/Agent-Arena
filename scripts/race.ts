/**
 * Phase 2: a full race from the terminal, persisted to Supabase, with a scorecard.
 *   npm run race -- [modelA] [modelB] [taskId]
 */
import { createRace } from '@/lib/db';
import { DEFAULT_MODELS } from '@/lib/models';
import { runRace } from '@/lib/race';
import { decideWinner } from '@/lib/score';
import { consoleSink } from '@/lib/sink';
import type { RunSummary } from '@/lib/types';
import { getTask, TASKS } from '@/tasks';

async function main() {
  const [modelA = DEFAULT_MODELS.A, modelB = DEFAULT_MODELS.B, taskId = TASKS[0].id] = process.argv.slice(2);
  if (!getTask(taskId)) throw new Error(`Unknown task "${taskId}"`);

  const race = await createRace({ taskId, modelA, modelB });
  console.log(`Race #${race.seq} (${race.id}): ${modelA} vs ${modelB} on ${taskId}\n`);

  const done = await runRace(race.id, { extraSink: (racer) => consoleSink(`${racer} ${racer === 'A' ? modelA : modelB}`) });

  const { A, B } = done.runs;
  const row = (label: string, f: (r: RunSummary) => string) => [label, f(A), f(B)];
  console.log('\nScorecard');
  console.table([
    row('model', (r) => r.model),
    row('verified', (r) => (r.verifiedSuccess ? 'PASS' : 'FAIL')),
    row('outcome', (r) => r.status),
    row('steps', (r) => String(r.steps)),
    row('tool errors', (r) => String(r.toolErrors)),
    row('time', (r) => `${((r.durationMs ?? 0) / 1000).toFixed(1)}s`),
    row('tokens in/out', (r) => `${r.inputTokens ?? 0}/${r.outputTokens ?? 0}`),
  ].map(([metric, a, b]) => ({ metric, 'Racer A': a, 'Racer B': b })));

  const verdict = decideWinner(A, B);
  console.log(verdict.winner ? `\n🏆 Racer ${verdict.winner} wins — ${verdict.reason}` : `\n${verdict.reason}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
