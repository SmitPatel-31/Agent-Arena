import type { Content, FunctionDeclaration, GenerateContentResponse, GoogleGenAI, Part } from '@google/genai';
import { compactForModel } from './compact';
import { classifyGeminiError } from './gemini';
import { executeInstrumented, truncateJson, type ToolExecutor } from './instrument';
import { errorMessage, RetriesExhaustedError, withBackoff } from './retry';
import type { EventSink } from './sink';
import type { AgentOutcome } from './types';

export interface AgentConfig {
  ai: GoogleGenAI;
  model: string;
  systemInstruction: string;
  prompt: string;
  tools: FunctionDeclaration[];
  execute: ToolExecutor;
  sink: EventSink;
  maxSteps?: number;
  timeoutMs?: number;
}

export interface AgentResult {
  outcome: AgentOutcome;
  finalAnswer: string | null;
  error: string | null;
  steps: number;
  toolCalls: number;
  toolErrors: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export const DEFAULT_MAX_STEPS = 15;
export const DEFAULT_TIMEOUT_MS = 3 * 60_000;

/** Tool output can be huge (GitHub issue lists); cap what goes back into the context window. */
const MODEL_OUTPUT_CHARS = 16_000;
/** What the UI timeline shows per tool result. */
const UI_OUTPUT_CHARS = 1_500;
const PER_TOOL_TIMEOUT_MS = 60_000;

/**
 * One racer's loop: ask the model, run any function calls through Composio,
 * feed the results back, repeat. A "step" is one model call.
 *
 * We keep the transcript ourselves (rather than using `ai.chats`) so a retried
 * 429 can never leave half a turn in history, and so Gemini's thought signatures
 * are echoed back verbatim with the model's own `Content`.
 */
export async function runAgent(config: AgentConfig): Promise<AgentResult> {
  const { ai, model, sink, execute } = config;
  const maxSteps = config.maxSteps ?? DEFAULT_MAX_STEPS;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const startedAt = Date.now();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error('timeout')), timeoutMs);

  const stats = { steps: 0, toolCalls: 0, toolErrors: 0, inputTokens: 0, outputTokens: 0 };
  const result = (outcome: AgentOutcome, finalAnswer: string | null, error: string | null): AgentResult => ({
    outcome,
    finalAnswer,
    error,
    ...stats,
    durationMs: Date.now() - startedAt,
  });

  const contents: Content[] = [{ role: 'user', parts: [{ text: config.prompt }] }];

  try {
    while (stats.steps < maxSteps) {
      const step = ++stats.steps;
      sink.emit({ type: 'model_thinking', payload: { step } });

      const response = await withBackoff(
        () =>
          ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: config.systemInstruction,
              tools: [{ functionDeclarations: config.tools }],
              thinkingConfig: { includeThoughts: true },
              abortSignal: deadline.signal,
            },
          }),
        {
          retries: 5,
          baseMs: 2_000,
          maxMs: 30_000,
          classify: classifyGeminiError,
          signal: deadline.signal,
          onRetry: ({ attempt, waitMs, error }) =>
            sink.emit({ type: 'rate_limited', payload: { attempt, waitMs, message: summarizeApiError(error) } }),
        },
      );

      stats.inputTokens += response.usageMetadata?.promptTokenCount ?? 0;
      stats.outputTokens +=
        (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0);

      const content = response.candidates?.[0]?.content;
      const { thoughts, text } = splitText(content?.parts ?? []);
      if (thoughts) sink.emit({ type: 'model_thinking', payload: { step, text: thoughts } });

      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        if (text) {
          sink.emit({ type: 'final_answer', payload: { step, text } });
          return result('completed', text, null);
        }
        // Empty turn (e.g. MALFORMED_FUNCTION_CALL). Nudge once per step instead of ending the run.
        if (content?.parts?.length) contents.push(content);
        contents.push({
          role: 'user',
          parts: [{ text: `Your last response was empty or malformed (${finishReason(response)}). Continue the task.` }],
        });
        continue;
      }

      contents.push(content ?? { role: 'model', parts: calls.map((fc) => ({ functionCall: fc })) });

      const responses: Part[] = [];
      for (const [i, fc] of calls.entries()) {
        const callId = fc.id ?? `${step}.${i}`;
        const tool = fc.name ?? 'unknown_tool';
        const args = fc.args ?? {};
        sink.emit({ type: 'tool_call', payload: { step, callId, tool, args } });

        const remaining = timeoutMs - (Date.now() - startedAt);
        const exec = await executeInstrumented(execute, { callId, tool, args }, { timeoutMs: Math.max(1_000, Math.min(PER_TOOL_TIMEOUT_MS, remaining)) });
        if (deadline.signal.aborted) throw deadline.signal.reason;

        stats.toolCalls++;
        if (!exec.success) stats.toolErrors++;
        sink.emit({
          type: 'tool_result',
          payload: {
            step,
            callId,
            tool,
            success: exec.success,
            durationMs: exec.durationMs,
            error: exec.error,
            output: truncateJson(exec.data, UI_OUTPUT_CHARS),
          },
        });

        responses.push({
          functionResponse: {
            id: fc.id,
            name: tool,
            response: exec.success ? modelSafeOutput(exec.data) : { error: exec.error },
          },
        });
      }
      contents.push({ role: 'user', parts: responses });
    }

    const message = `Stopped after ${maxSteps} steps without a final answer.`;
    sink.emit({ type: 'run_failed', payload: { outcome: 'step_limit', message } });
    return result('step_limit', null, message);
  } catch (error) {
    const timedOut = deadline.signal.aborted;
    const outcome: AgentOutcome = timedOut ? 'timed_out' : 'error';
    const message = timedOut
      ? `Hit the ${Math.round(timeoutMs / 1000)}s time limit.`
      : error instanceof RetriesExhaustedError
        ? `Gemini rate limit: gave up after ${error.attempts} attempts. ${summarizeApiError(error.lastError)}`
        : summarizeApiError(error);
    sink.emit({ type: 'run_failed', payload: { outcome, message } });
    return result(outcome, null, message);
  } finally {
    clearTimeout(timer);
  }
}

function splitText(parts: Part[]): { thoughts: string; text: string } {
  const pick = (thought: boolean) =>
    parts
      .filter((p) => typeof p.text === 'string' && Boolean(p.thought) === thought)
      .map((p) => p.text)
      .join('\n')
      .trim();
  return { thoughts: pick(true), text: pick(false) };
}

function modelSafeOutput(data: Record<string, unknown> | null): Record<string, unknown> {
  const compact = compactForModel(data ?? {});
  const json = JSON.stringify(compact);
  return json.length <= MODEL_OUTPUT_CHARS ? { output: compact } : { output_truncated: truncateJson(json, MODEL_OUTPUT_CHARS) };
}

function finishReason(response: GenerateContentResponse): string {
  return response.candidates?.[0]?.finishReason ?? 'no finish reason';
}

/** Gemini errors embed a JSON body in the message; keep just the human part. */
function summarizeApiError(error: unknown): string {
  const raw = errorMessage(error);
  const match = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(raw);
  const message = match ? match[1].replace(/\\n/g, ' ').replace(/\\"/g, '"') : raw;
  return message.slice(0, 300);
}
