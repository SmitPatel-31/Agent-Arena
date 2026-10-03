import { ApiError, GoogleGenAI } from '@google/genai';
import { getEnv } from './env';

let client: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY });
  return client;
}

/**
 * A free-tier per-day quota is used up. Retrying inside a 3-minute race is pointless
 * (Google's retryDelay is often over an hour), so the run should fail fast and say so.
 */
export class DailyQuotaError extends Error {
  constructor(
    public readonly model: string,
    public readonly limit: number | null,
    public readonly resetInMs: number | null,
  ) {
    const reset = resetInMs ? ` It resets in about ${Math.ceil(resetInMs / 60_000)} min.` : '';
    super(`Daily free-tier quota for ${model} is used up${limit ? ` (${limit} requests/day)` : ''}.${reset} Pick another model.`);
    this.name = 'DailyQuotaError';
  }
}

function retryDelayMs(message: string): number | undefined {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}

/** Per-day quota exhaustion looks like any other 429; the quotaId tells them apart. */
export function asDailyQuotaError(error: unknown, model: string): DailyQuotaError | null {
  if (!(error instanceof ApiError) || error.status !== 429 || !/PerDay/i.test(error.message)) return null;
  const limit = /"quotaValue"\s*:\s*"(\d+)"/.exec(error.message);
  return new DailyQuotaError(model, limit ? Number(limit[1]) : null, retryDelayMs(error.message) ?? null);
}

/**
 * Free-tier Gemini returns 429 (per-minute quota) and 503 (overloaded); both are worth
 * retrying, honouring Google's RetryInfo hint. Daily quotas and everything else are not.
 */
export function classifyGeminiError(error: unknown): { retryAfterMs?: number } | null {
  if (!(error instanceof ApiError) || (error.status !== 429 && error.status !== 503)) return null;
  if (error.status === 429 && /PerDay/i.test(error.message)) return null;
  const retryAfterMs = retryDelayMs(error.message);
  return retryAfterMs === undefined ? {} : { retryAfterMs };
}
