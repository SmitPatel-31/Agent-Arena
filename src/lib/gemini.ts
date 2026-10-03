import { ApiError, GoogleGenAI } from '@google/genai';
import { getEnv } from './env';

let client: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY });
  return client;
}

/**
 * Free-tier Gemini returns 429 (quota) and occasionally 503 (overloaded).
 * Both are worth retrying; anything else (bad request, auth) is not.
 * When Google includes a RetryInfo hint ("retryDelay": "17s") we honour it.
 */
export function classifyGeminiError(error: unknown): { retryAfterMs?: number } | null {
  if (!(error instanceof ApiError) || (error.status !== 429 && error.status !== 503)) return null;
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(error.message);
  return match ? { retryAfterMs: Math.ceil(Number(match[1]) * 1000) } : {};
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}
