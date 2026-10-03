/**
 * Folds the SSE event stream into what each pane renders. Pure, so the race page
 * behaves identically whether events arrive live or as a replay of a finished race.
 */
import type { AgentOutcome, Racer, StreamEvent, VerificationResult } from './types';

/** Every item records when it happened (ms epoch) so the telemetry strip can place it on a time axis. */
export type TimelineItem = TimelineEntry & { at: number };

type TimelineEntry =
  | { kind: 'thinking'; key: string; step: number; text: string }
  | {
      kind: 'tool';
      key: string;
      step: number;
      tool: string;
      args: Record<string, unknown>;
      result?: { success: boolean; durationMs: number; error: string | null; output: string; at: number };
    }
  | { kind: 'rate_limited'; key: string; attempt: number; waitMs: number; message: string }
  | { kind: 'final_answer'; key: string; text: string }
  | { kind: 'failed'; key: string; outcome: AgentOutcome; message: string }
  | { kind: 'verification'; key: string; result: VerificationResult };

export type Phase = 'waiting' | 'thinking' | 'calling' | 'verifying' | 'verified';

export interface RacerState {
  phase: Phase;
  step: number;
  toolCalls: number;
  toolErrors: number;
  startedAt: number | null;
  /** When the agent stopped (answer or failure); the timer freezes here. */
  finishedAt: number | null;
  verification: VerificationResult | null;
  timeline: TimelineItem[];
}

export type RaceState = Record<Racer, RacerState>;

export const emptyRacer = (): RacerState => ({
  phase: 'waiting',
  step: 0,
  toolCalls: 0,
  toolErrors: 0,
  startedAt: null,
  finishedAt: null,
  verification: null,
  timeline: [],
});

export const initialRaceState = (): RaceState => ({ A: emptyRacer(), B: emptyRacer() });

export function applyEvent(state: RaceState, event: StreamEvent): RaceState {
  return { ...state, [event.racer]: reduceRacer(state[event.racer], event) };
}

function reduceRacer(s: RacerState, e: StreamEvent): RacerState {
  const at = Date.parse(e.at);
  const key = String(e.id);
  switch (e.type) {
    case 'run_started':
      return { ...s, phase: 'thinking', startedAt: at };
    case 'model_thinking':
      return {
        ...s,
        phase: 'thinking',
        step: Math.max(s.step, e.payload.step),
        timeline: e.payload.text ? [...s.timeline, { kind: 'thinking', key, at, step: e.payload.step, text: e.payload.text }] : s.timeline,
      };
    case 'tool_call':
      return {
        ...s,
        phase: 'calling',
        timeline: [...s.timeline, { kind: 'tool', key: e.payload.callId + key, at, step: e.payload.step, tool: e.payload.tool, args: e.payload.args }],
      };
    case 'tool_result': {
      const { success, durationMs, error, output, tool } = e.payload;
      // Attach to the latest unresolved call for this tool (call ids from Gemini can repeat across steps).
      const idx = findLastIndex(s.timeline, (t) => t.kind === 'tool' && t.tool === tool && !t.result);
      const timeline =
        idx === -1
          ? s.timeline
          : s.timeline.map((t, i) => (i === idx && t.kind === 'tool' ? { ...t, result: { success, durationMs, error, output, at } } : t));
      return { ...s, timeline, toolCalls: s.toolCalls + 1, toolErrors: s.toolErrors + (success ? 0 : 1) };
    }
    case 'rate_limited':
      return { ...s, timeline: [...s.timeline, { kind: 'rate_limited', key, at, ...e.payload }] };
    case 'final_answer':
      return { ...s, phase: 'verifying', finishedAt: at, timeline: [...s.timeline, { kind: 'final_answer', key, at, text: e.payload.text }] };
    case 'run_failed':
      return { ...s, phase: 'verifying', finishedAt: at, timeline: [...s.timeline, { kind: 'failed', key, at, ...e.payload }] };
    case 'verification_result': {
      const result = { success: e.payload.success, checks: e.payload.checks };
      return { ...s, phase: 'verified', verification: result, timeline: [...s.timeline, { kind: 'verification', key, at, result }] };
    }
    default:
      return s;
  }
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (predicate(items[i])) return i;
  return -1;
}
