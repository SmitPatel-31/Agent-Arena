import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, RetriesExhaustedError, withBackoff } from './retry';

const noSleep = async () => {};
const retryable = () => ({});

describe('withBackoff', () => {
  it('retries retryable errors and reports each wait', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('429')).mockRejectedValueOnce(new Error('429')).mockResolvedValue('ok');
    const onRetry = vi.fn();

    const value = await withBackoff(fn, { retries: 3, baseMs: 1_000, maxMs: 8_000, classify: retryable, onRetry, sleep: noSleep, random: () => 1 });

    expect(value).toBe('ok');
    expect(onRetry.mock.calls.map(([info]) => [info.attempt, info.waitMs])).toEqual([
      [1, 1_000],
      [2, 2_000],
    ]);
  });

  it('prefers the server retry hint, capped at maxMs', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValue('ok');
    const onRetry = vi.fn();
    await withBackoff(fn, { retries: 1, baseMs: 1_000, maxMs: 10_000, classify: () => ({ retryAfterMs: 60_000 }), onRetry, sleep: noSleep });
    expect(onRetry.mock.calls[0][0].waitMs).toBe(10_000);
  });

  it('never waits less than the computed backoff, even if the server says 0s', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValue('ok');
    const onRetry = vi.fn();
    await withBackoff(fn, { retries: 1, baseMs: 2_000, maxMs: 30_000, classify: () => ({ retryAfterMs: 0 }), onRetry, sleep: noSleep, random: () => 1 });
    expect(onRetry.mock.calls[0][0].waitMs).toBe(2_000);
  });

  it('rethrows non-retryable errors immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('400 bad request'));
    await expect(withBackoff(fn, { retries: 5, baseMs: 1, maxMs: 1, classify: () => null, sleep: noSleep })).rejects.toThrow('400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('429'));
    await expect(withBackoff(fn, { retries: 2, baseMs: 1, maxMs: 1, classify: retryable, sleep: noSleep })).rejects.toBeInstanceOf(
      RetriesExhaustedError,
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('backoffDelay', () => {
  it('doubles and caps, with jitter in the upper half', () => {
    const opts = { baseMs: 1_000, maxMs: 5_000 };
    expect(backoffDelay(1, opts, () => 0)).toBe(500);
    expect(backoffDelay(3, opts, () => 1)).toBe(4_000);
    expect(backoffDelay(10, opts, () => 1)).toBe(5_000);
  });
});
