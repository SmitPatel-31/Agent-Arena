/** Shared domain types. Imported by both server code and client components, so keep it free of runtime deps. */

export type Racer = 'A' | 'B';
export const RACERS: readonly Racer[] = ['A', 'B'] as const;

/** How the agent loop ended, independent of whether the task was really done. */
export type AgentOutcome = 'completed' | 'step_limit' | 'timed_out' | 'error';

export type RunStatus = 'running' | 'verifying' | AgentOutcome;

export const TERMINAL_STATUSES: readonly RunStatus[] = ['completed', 'step_limit', 'timed_out', 'error'];

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  success: boolean;
  checks: VerificationCheck[];
}

/**
 * Everything a run can report. `type` + `payload` is exactly what lands in the
 * `events` table and on the SSE stream, so this union is the wire contract.
 */
export type RunEvent =
  | { type: 'run_started'; payload: { model: string; taskId: string; tools: string[] } }
  | { type: 'model_thinking'; payload: { step: number; text?: string } }
  | {
      type: 'tool_call';
      payload: { step: number; callId: string; tool: string; args: Record<string, unknown> };
    }
  | {
      type: 'tool_result';
      payload: {
        step: number;
        callId: string;
        tool: string;
        success: boolean;
        durationMs: number;
        error: string | null;
        output: string;
      };
    }
  | { type: 'rate_limited'; payload: { attempt: number; waitMs: number; message: string } }
  | { type: 'final_answer'; payload: { step: number; text: string } }
  | { type: 'run_failed'; payload: { outcome: AgentOutcome; message: string } }
  | { type: 'verification_result'; payload: VerificationResult & { durationMs: number } };

export type RunEventType = RunEvent['type'];

/** A persisted event as streamed to the browser. */
export type StreamEvent = RunEvent & { id: number; racer: Racer; at: string };

export interface RunSummary {
  id: string;
  racer: Racer;
  model: string;
  status: RunStatus;
  verifiedSuccess: boolean | null;
  steps: number;
  toolErrors: number;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  finalAnswer: string | null;
}

export interface RaceSummary {
  id: string;
  seq: number;
  taskId: string;
  createdAt: string;
  runs: Record<Racer, RunSummary>;
}

/** A race unfinished after this long lost its server process (e.g. the function was killed). */
export const STALE_AFTER_MS = 8 * 60_000;

export function isStale(createdAt: string, now = Date.now()): boolean {
  return now - Date.parse(createdAt) > STALE_AFTER_MS;
}
