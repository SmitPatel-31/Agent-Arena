import { describe, expect, it, vi } from 'vitest';
import { executeInstrumented, truncateJson, type ToolExecutor } from './instrument';

const call = { callId: 'c1', tool: 'NOTION_CREATE_NOTION_PAGE', args: { title: 'x' } };

/** A clock that advances by `step` ms on every read. */
function fakeClock(start = 1_000, step = 250) {
  let t = start - step;
  return () => (t += step);
}

describe('executeInstrumented', () => {
  it('records success, duration and data', async () => {
    const execute = vi.fn<ToolExecutor>().mockResolvedValue({ successful: true, data: { id: 'p1' }, error: null });

    const exec = await executeInstrumented(execute, call, { now: fakeClock() });

    expect(execute).toHaveBeenCalledWith('NOTION_CREATE_NOTION_PAGE', { title: 'x' });
    expect(exec).toMatchObject({ ...call, success: true, error: null, data: { id: 'p1' }, startedAt: 1_000, durationMs: 250 });
  });

  it('treats successful:false as a failure and keeps the tool error message', async () => {
    const execute: ToolExecutor = async () => ({ successful: false, data: {}, error: 'object_not_found' });

    const exec = await executeInstrumented(execute, call);

    expect(exec.success).toBe(false);
    expect(exec.error).toBe('object_not_found');
  });

  it('fills in a message when the tool fails silently', async () => {
    const execute: ToolExecutor = async () => ({ successful: false, data: {}, error: null });
    expect((await executeInstrumented(execute, call)).error).toMatch(/without a message/);
  });

  it('never throws: thrown errors become failed executions, including the cause', async () => {
    const execute: ToolExecutor = async () => {
      throw new Error('Request failed', { cause: new Error('401 invalid api key') });
    };

    const exec = await executeInstrumented(execute, call, { now: fakeClock() });

    expect(exec).toMatchObject({ success: false, data: null, error: 'Request failed: 401 invalid api key' });
    expect(exec.durationMs).toBe(250);
  });

  it('times out slow tools', async () => {
    vi.useFakeTimers();
    try {
      const execute: ToolExecutor = () => new Promise(() => {});
      const pending = executeInstrumented(execute, call, { timeoutMs: 5_000 });
      await vi.advanceTimersByTimeAsync(5_000);
      const exec = await pending;
      expect(exec.success).toBe(false);
      expect(exec.error).toMatch(/did not respond within 5s/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('truncateJson', () => {
  it('leaves short payloads alone and marks truncated ones', () => {
    expect(truncateJson({ a: 1 }, 100)).toBe('{"a":1}');
    expect(truncateJson('x'.repeat(30), 10)).toBe(`${'x'.repeat(10)}… [truncated 20 chars]`);
  });
});
