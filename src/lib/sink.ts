import type { RunEvent } from './types';

/**
 * Where a run's events go. The agent calls `emit` synchronously and never waits on I/O;
 * implementations must preserve order. `flush` resolves once everything is persisted.
 */
export interface EventSink {
  emit(event: RunEvent): void;
  flush(): Promise<void>;
}

/** Serialises async writes so events land in emit order without blocking the agent. */
export class OrderedSink implements EventSink {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly write: (event: RunEvent) => Promise<void>,
    private readonly onError: (error: unknown, event: RunEvent) => void = (error, event) =>
      console.error(`[sink] failed to persist ${event.type}:`, error),
  ) {}

  emit(event: RunEvent): void {
    this.tail = this.tail.then(() => this.write(event)).catch((error) => this.onError(error, event));
  }

  flush(): Promise<void> {
    return this.tail;
  }
}

export function fanOut(...sinks: EventSink[]): EventSink {
  return {
    emit: (event) => sinks.forEach((s) => s.emit(event)),
    flush: async () => {
      await Promise.all(sinks.map((s) => s.flush()));
    },
  };
}

/** Human-readable terminal log for the phase 1/2 scripts. */
export function consoleSink(label: string): EventSink {
  const prefix = `[${label}]`;
  return {
    emit(event) {
      switch (event.type) {
        case 'run_started':
          return console.log(prefix, `▶ ${event.payload.model} with ${event.payload.tools.length} tools`);
        case 'model_thinking':
          return console.log(prefix, `… step ${event.payload.step}${event.payload.text ? `: ${oneLine(event.payload.text)}` : ''}`);
        case 'tool_call':
          return console.log(prefix, `→ ${event.payload.tool} ${oneLine(JSON.stringify(event.payload.args))}`);
        case 'tool_result':
          return console.log(
            prefix,
            `${event.payload.success ? '✓' : '✗'} ${event.payload.tool} ${event.payload.durationMs}ms${event.payload.error ? ` — ${oneLine(event.payload.error)}` : ''}`,
          );
        case 'rate_limited':
          return console.log(prefix, `⏳ rate limited, retry #${event.payload.attempt} in ${event.payload.waitMs}ms`);
        case 'final_answer':
          return console.log(prefix, `■ ${oneLine(event.payload.text)}`);
        case 'run_failed':
          return console.log(prefix, `✗ ${event.payload.outcome}: ${event.payload.message}`);
        case 'verification_result':
          console.log(prefix, `⚖ verified: ${event.payload.success ? 'PASS' : 'FAIL'}`);
          for (const c of event.payload.checks) console.log(prefix, `   ${c.passed ? '✓' : '✗'} ${c.label}${c.detail ? ` (${c.detail})` : ''}`);
          return;
        default:
          return assertNever(event);
      }
    },
    flush: async () => {},
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}

function oneLine(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
