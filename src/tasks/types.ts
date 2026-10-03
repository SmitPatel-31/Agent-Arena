import type { ToolExecutor } from '@/lib/instrument';
import type { Racer, VerificationResult } from '@/lib/types';
import type { ToolkitSlug } from '@/lib/composio';

export interface TaskContext {
  racer: Racer;
  runNumber: number;
  /** When the race started; verifiers ignore anything older. */
  startedAt: Date;
}

export interface TaskDefinition {
  id: string;
  title: string;
  /** One line for the task picker. */
  summary: string;
  difficulty: 'easy' | 'medium' | 'hard';
  toolkits: readonly ToolkitSlug[];
  /**
   * The exact tools both racers get. Curated rather than "whole toolkit" so the
   * prompt fits free-tier token limits and both models face identical choices.
   */
  tools: readonly string[];
  prompt(ctx: TaskContext): string;
  /** Checks the real world through Composio. Never reads the model's answer. */
  verify(ctx: TaskContext, execute: ToolExecutor): Promise<VerificationResult>;
}

/** Name every racer-owned artifact uses, so the two agents never touch each other's output. */
export function racerLabel(ctx: TaskContext): string {
  return `Racer ${ctx.racer}`;
}

export function runTag(ctx: TaskContext): string {
  return `[Racer ${ctx.racer} · Run ${ctx.runNumber}]`;
}
