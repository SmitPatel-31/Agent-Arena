import { runAgent, type AgentResult } from './agent';
import { executeTool, getToolDeclarations } from './composio';
import { getRace, insertEvent, updateRun } from './db';
import { getGemini } from './gemini';
import { errorMessage } from './retry';
import { fanOut, OrderedSink, type EventSink } from './sink';
import type { RaceSummary, Racer, RunSummary, VerificationResult } from './types';
import { getTask, systemInstruction, type TaskDefinition } from '@/tasks';

export interface RaceOptions {
  /** Extra sink per racer, e.g. the terminal logger in scripts/race.ts. */
  extraSink?: (racer: Racer) => EventSink;
}

/**
 * Runs both racers concurrently, then verifies each against the real world.
 * Never throws for a racer's failure: every outcome is recorded on the run row.
 */
export async function runRace(raceId: string, options: RaceOptions = {}): Promise<RaceSummary> {
  const race = await getRace(raceId);
  if (!race) throw new Error(`Race ${raceId} not found`);
  const task = getTask(race.taskId);
  if (!task) throw new Error(`Unknown task ${race.taskId}`);

  const startedAt = new Date();
  let tools: Awaited<ReturnType<typeof getToolDeclarations>>;
  try {
    tools = await getToolDeclarations(task.tools);
  } catch (error) {
    // Nothing can run without tools; fail both racers visibly rather than hanging the UI.
    const message = `Could not load Composio tools: ${errorMessage(error)}`;
    await Promise.all(
      (['A', 'B'] as const).map(async (racer) => {
        await insertEvent(race.runs[racer].id, { type: 'run_failed', payload: { outcome: 'error', message } });
        await updateRun(race.runs[racer].id, { status: 'error', verified_success: false });
      }),
    );
    return (await getRace(raceId))!;
  }

  await Promise.all(
    (['A', 'B'] as const).map((racer) =>
      runRacer({ race, run: race.runs[racer], task, tools, startedAt, extraSink: options.extraSink?.(racer) }),
    ),
  );
  return (await getRace(raceId))!;
}

interface RacerInput {
  race: RaceSummary;
  run: RunSummary;
  task: TaskDefinition;
  tools: Awaited<ReturnType<typeof getToolDeclarations>>;
  startedAt: Date;
  extraSink?: EventSink;
}

async function runRacer({ race, run, task, tools, startedAt, extraSink }: RacerInput): Promise<void> {
  const ctx = { racer: run.racer, runNumber: race.seq, startedAt };
  const dbSink = new OrderedSink((event) => insertEvent(run.id, event));
  const sink = extraSink ? fanOut(dbSink, extraSink) : dbSink;

  let agent: AgentResult;
  try {
    sink.emit({ type: 'run_started', payload: { model: run.model, taskId: task.id, tools: [...task.tools] } });
    agent = await runAgent({
      ai: getGemini(),
      model: run.model,
      systemInstruction: systemInstruction(ctx),
      prompt: task.prompt(ctx),
      tools,
      execute: executeTool,
      sink,
    });
  } catch (error) {
    // runAgent handles its own failures; this is a last-resort guard.
    const message = errorMessage(error);
    sink.emit({ type: 'run_failed', payload: { outcome: 'error', message } });
    agent = { outcome: 'error', finalAnswer: null, error: message, steps: 0, toolCalls: 0, toolErrors: 0, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - startedAt.getTime() };
  }

  await sink.flush();
  await updateRun(run.id, {
    status: 'verifying',
    steps: agent.steps,
    tool_errors: agent.toolErrors,
    duration_ms: agent.durationMs,
    input_tokens: agent.inputTokens,
    output_tokens: agent.outputTokens,
    final_answer: agent.finalAnswer ?? agent.error,
  });

  // Verify even failed runs: an agent can finish the work and then time out before saying so.
  const verifyStart = Date.now();
  const verdict: VerificationResult = await task.verify(ctx, executeTool);
  sink.emit({ type: 'verification_result', payload: { ...verdict, durationMs: Date.now() - verifyStart } });
  await sink.flush();

  await updateRun(run.id, { status: agent.outcome, verified_success: verdict.success });
}
