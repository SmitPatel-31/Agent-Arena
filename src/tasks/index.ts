import { githubToNotion } from './github-to-notion';
import { gmailToCalendar } from './gmail-to-calendar';
import { slackSummary } from './slack-summary';
import { racerLabel, type TaskContext, type TaskDefinition } from './types';

export const TASKS: readonly TaskDefinition[] = [githubToNotion, slackSummary, gmailToCalendar];

export function getTask(id: string): TaskDefinition | undefined {
  return TASKS.find((t) => t.id === id);
}

/** Shared rules for every racer. The side-effect rule is what keeps two agents on one account from colliding. */
export function systemInstruction(ctx: TaskContext): string {
  return [
    `You are ${racerLabel(ctx)} in Agent Arena run ${ctx.runNumber}: two AI agents race to complete the same task with the same tools.`,
    `Rules:`,
    `- Act only through the provided tools. Do not ask the user questions; nobody will answer.`,
    `- Only create or modify things labeled with "${racerLabel(ctx)}" and run ${ctx.runNumber}. Never edit, delete, or reply to anything else, including the other racer's output.`,
    `- Be efficient: every tool call and every second counts. Request only the data you need.`,
    `- If a tool returns an error, read it, fix your arguments, and try again.`,
    `- When the task is fully done, reply with a brief plain-text confirmation and no further tool calls.`,
  ].join('\n');
}

export type { TaskContext, TaskDefinition };
