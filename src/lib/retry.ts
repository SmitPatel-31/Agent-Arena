/** Exponential backoff with jitter, used for Gemini 429/503 responses. */

export interface RetryInfo {
  attempt: number;
  waitMs: number;
  error: unknown;
}

export interface BackoffOptions {
  /** Retries after the first attempt. */
  retries: number;
  baseMs: number;
  maxMs: number;
  /** Return null to rethrow immediately, or an optional server-suggested delay. */
  classify: (error: unknown) => { retryAfterMs?: number } | null;
  onRetry?: (info: RetryInfo) => void;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}

export class RetriesExhaustedError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(`Gave up after ${attempts} attempts: ${errorMessage(lastError)}`);
    this.name = 'RetriesExhaustedError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function backoffDelay(attempt: number, opts: Pick<BackoffOptions, 'baseMs' | 'maxMs'>, random = Math.random): number {
  const exp = Math.min(opts.maxMs, opts.baseMs * 2 ** (attempt - 1));
  // Full jitter on the upper half keeps two racers from retrying in lockstep.
  return Math.round(exp / 2 + random() * (exp / 2));
}

export const abortableSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export async function withBackoff<T>(fn: () => Promise<T>, opts: BackoffOptions): Promise<T> {
  const sleep = opts.sleep ?? abortableSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      const decision = opts.classify(error);
      if (!decision) throw error;
      if (attempt > opts.retries) throw new RetriesExhaustedError(attempt, error);

      // A server hint can lengthen our backoff but never shorten it (Gemini sometimes says "0s").
      const computed = backoffDelay(attempt, opts, opts.random);
      const waitMs = Math.min(opts.maxMs, Math.max(computed, decision.retryAfterMs ?? 0));
      opts.onRetry?.({ attempt, waitMs, error });
      await sleep(waitMs, opts.signal);
    }
  }
}
