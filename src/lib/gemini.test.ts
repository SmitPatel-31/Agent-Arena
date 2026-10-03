import { ApiError } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { asDailyQuotaError, classifyGeminiError } from './gemini';

const apiError = (status: number, body: string) => new ApiError({ status, message: body });

const PER_DAY = '{"error":{"code":429,"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaValue":"20"},{"retryDelay":"5029s"}]}}';
const PER_MINUTE = '{"error":{"code":429,"details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"},{"retryDelay":"17s"}]}}';

describe('classifyGeminiError', () => {
  it('retries per-minute 429s with the server hint and 503s without one', () => {
    expect(classifyGeminiError(apiError(429, PER_MINUTE))).toEqual({ retryAfterMs: 17_000 });
    expect(classifyGeminiError(apiError(503, 'high demand'))).toEqual({});
  });

  it('does not retry daily quota exhaustion or client errors', () => {
    expect(classifyGeminiError(apiError(429, PER_DAY))).toBeNull();
    expect(classifyGeminiError(apiError(400, 'bad request'))).toBeNull();
    expect(classifyGeminiError(new Error('network'))).toBeNull();
  });
});

describe('asDailyQuotaError', () => {
  it('explains the limit and when it resets', () => {
    const err = asDailyQuotaError(apiError(429, PER_DAY), 'gemini-3.8-flash');
    expect(err?.message).toBe('Daily free-tier quota for gemini-3.8-flash is used up (20 requests/day). It resets in about 84 min. Pick another model.');
    expect(asDailyQuotaError(apiError(429, PER_MINUTE), 'm')).toBeNull();
  });
});
