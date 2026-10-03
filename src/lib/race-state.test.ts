import { describe, expect, it } from 'vitest';
import { applyEvent, initialRaceState, type RaceState } from './race-state';
import type { RunEvent, StreamEvent } from './types';

let id = 0;
const ev = (racer: 'A' | 'B', event: RunEvent, at = '2026-10-03T12:00:00.000Z'): StreamEvent => ({ ...event, id: ++id, racer, at });

const fold = (events: StreamEvent[]): RaceState => events.reduce(applyEvent, initialRaceState());

describe('applyEvent', () => {
  it('tracks steps, pairs tool results with calls, and counts errors per racer', () => {
    const s = fold([
      ev('A', { type: 'run_started', payload: { model: 'm', taskId: 't', tools: [] } }, '2026-10-03T12:00:00.000Z'),
      ev('A', { type: 'model_thinking', payload: { step: 1 } }),
      ev('A', { type: 'tool_call', payload: { step: 1, callId: 'x', tool: 'NOTION_CREATE_NOTION_PAGE', args: { title: 't' } } }),
      ev('B', { type: 'model_thinking', payload: { step: 1 } }),
      ev('A', {
        type: 'tool_result',
        payload: { step: 1, callId: 'x', tool: 'NOTION_CREATE_NOTION_PAGE', success: false, durationMs: 40, error: 'object_not_found', output: '{}' },
      }),
      ev('A', { type: 'final_answer', payload: { step: 2, text: 'done' } }, '2026-10-03T12:00:07.500Z'),
    ]);

    expect(s.A).toMatchObject({ phase: 'verifying', step: 1, toolCalls: 1, toolErrors: 1 });
    expect(s.A.finishedAt! - s.A.startedAt!).toBe(7_500);
    expect(s.A.timeline[0]).toMatchObject({ kind: 'tool', result: { success: false, error: 'object_not_found' } });
    expect(s.B).toMatchObject({ phase: 'thinking', step: 1, toolCalls: 0 });
  });

  it('marks a racer verified with the verification result', () => {
    const s = fold([ev('B', { type: 'verification_result', payload: { success: true, checks: [{ label: 'ok', passed: true }], durationMs: 5 } })]);
    expect(s.B.phase).toBe('verified');
    expect(s.B.verification?.success).toBe(true);
  });
});
