import { executeInstrumented, type ToolExecutor } from '@/lib/instrument';
import type { VerificationCheck, VerificationResult } from '@/lib/types';

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

type Json = Record<string, unknown>;

/** Run a tool for verification; a failed tool call is a verification error, not a crash. */
export async function callTool(execute: ToolExecutor, tool: string, args: Json): Promise<Json> {
  const exec = await executeInstrumented(execute, { callId: `verify:${tool}`, tool, args }, { timeoutMs: 30_000 });
  if (!exec.success || !exec.data) throw new VerificationError(`${tool} failed: ${exec.error ?? 'no data'}`);
  return exec.data;
}

/**
 * Composio wraps provider payloads differently per toolkit (`data.results`,
 * `data.response_data.results`, ...). Rather than hard-coding each envelope,
 * walk the tree and collect objects matching a predicate (not descending into matches).
 */
export function collectObjects(value: unknown, match: (o: Json) => boolean, out: Json[] = []): Json[] {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, match, out);
  } else if (isObject(value)) {
    if (match(value)) out.push(value);
    else for (const child of Object.values(value)) collectObjects(child, match, out);
  }
  return out;
}

export function findValue<T>(value: unknown, key: string, guard: (v: unknown) => v is T): T | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, key, guard);
      if (found !== undefined) return found;
    }
  } else if (isObject(value)) {
    if (key in value && guard(value[key])) return value[key];
    for (const child of Object.values(value)) {
      const found = findValue(child, key, guard);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** All string leaves concatenated: good enough to ask "does this page mention X?". */
export function allText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(allText).join('\n');
  if (isObject(value)) return Object.values(value).map(allText).join('\n');
  return '';
}

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Models swap em dashes for hyphens and double up spaces; compare titles loosely. */
export function normalizeTitle(text: string): string {
  return text
    .replace(/[‒-―−-]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function result(checks: VerificationCheck[]): VerificationResult {
  return { success: checks.length > 0 && checks.every((c) => c.passed), checks };
}

/** Wrap a verifier so infrastructure failures become a failed check instead of an exception. */
export async function safely(run: () => Promise<VerificationResult>): Promise<VerificationResult> {
  try {
    return await run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return result([{ label: 'Verifier could not complete', passed: false, detail }]);
  }
}
