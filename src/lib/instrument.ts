/**
 * The single choke point for every Composio tool execution, by an agent or by a verifier.
 *
 * It never throws: every outcome (success, tool-reported failure, thrown error, timeout)
 * becomes a `ToolExecution` record. The agent loop turns that record into events and
 * into the function response the model sees; the scorecard counts its `success` flags.
 */

/** Shape of `composio.tools.execute()`'s result, narrowed to what we use. */
export interface ToolResponse {
  successful: boolean;
  data: Record<string, unknown>;
  error: string | null;
}

export type ToolExecutor = (tool: string, args: Record<string, unknown>) => Promise<ToolResponse>;

export interface ToolCall {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolExecution extends ToolCall {
  startedAt: number;
  durationMs: number;
  success: boolean;
  error: string | null;
  data: Record<string, unknown> | null;
}

export interface InstrumentOptions {
  timeoutMs?: number;
  now?: () => number;
}

export class ToolTimeoutError extends Error {
  constructor(tool: string, timeoutMs: number) {
    super(`${tool} did not respond within ${Math.round(timeoutMs / 1000)}s`);
    this.name = 'ToolTimeoutError';
  }
}

export async function executeInstrumented(
  execute: ToolExecutor,
  call: ToolCall,
  { timeoutMs, now = Date.now }: InstrumentOptions = {},
): Promise<ToolExecution> {
  const startedAt = now();
  const finish = (fields: Pick<ToolExecution, 'success' | 'error' | 'data'>): ToolExecution => ({
    ...call,
    ...fields,
    startedAt,
    durationMs: Math.max(0, now() - startedAt),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pending = execute(call.tool, call.args);
    const response =
      timeoutMs === undefined
        ? await pending
        : await Promise.race([
            pending,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new ToolTimeoutError(call.tool, timeoutMs)), timeoutMs);
            }),
          ]);

    if (!response.successful) {
      return finish({ success: false, error: response.error || 'Tool reported failure without a message', data: response.data ?? null });
    }
    return finish({ success: true, error: null, data: response.data ?? {} });
  } catch (error) {
    return finish({ success: false, error: describeError(error), data: null });
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    // Composio errors carry the useful text on `cause` (e.g. HTTP body); surface it once.
    const cause = error.cause instanceof Error ? error.cause.message : undefined;
    return cause && !error.message.includes(cause) ? `${error.message}: ${cause}` : error.message;
  }
  return String(error);
}

/** Bound a JSON payload for the UI or for the model's context window. */
export function truncateJson(value: unknown, maxChars: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}… [truncated ${text.length - maxChars} chars]`;
}
