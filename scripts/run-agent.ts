/**
 * Phase 1: one model, one task, no database. Proves the agent loop and tool calls work.
 *   npm run agent -- [model] [taskId]
 */
import { runAgent } from '@/lib/agent';
import { executeTool, getToolDeclarations } from '@/lib/composio';
import { getGemini } from '@/lib/gemini';
import { DEFAULT_MODELS } from '@/lib/models';
import { consoleSink } from '@/lib/sink';
import { getTask, systemInstruction, TASKS } from '@/tasks';

async function main() {
  const [model = DEFAULT_MODELS.B, taskId = TASKS[0].id] = process.argv.slice(2);
  const task = getTask(taskId);
  if (!task) throw new Error(`Unknown task "${taskId}". Options: ${TASKS.map((t) => t.id).join(', ')}`);

  // Run number 0 marks scratch runs that never touched the database.
  const ctx = { racer: 'A' as const, runNumber: 0, startedAt: new Date() };
  const sink = consoleSink(`A ${model}`);
  const tools = await getToolDeclarations(task.tools);
  sink.emit({ type: 'run_started', payload: { model, taskId: task.id, tools: [...task.tools] } });

  const res = await runAgent({
    ai: getGemini(),
    model,
    systemInstruction: systemInstruction(ctx),
    prompt: task.prompt(ctx),
    tools,
    execute: executeTool,
    sink,
  });

  console.log('\nResult:', { ...res, finalAnswer: res.finalAnswer?.slice(0, 200) });
  console.log('\nVerifying against the real world…');
  const verdict = await task.verify(ctx, executeTool);
  sink.emit({ type: 'verification_result', payload: { ...verdict, durationMs: 0 } });
  process.exit(verdict.success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
