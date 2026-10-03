import type { TimelineItem } from '@/lib/race-state';
import { argsPreview, describeTool, formatDuration, plainText } from './format';

export function TimelineCard({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case 'thinking':
      return (
        <details className="group animate-card-in rounded-lg px-3 py-2 text-sm text-muted">
          <summary className="flex cursor-pointer list-none items-start gap-2">
            <span className="mt-0.5 shrink-0 font-mono text-[11px] uppercase tracking-wide">Step {item.step}</span>
            <span className="line-clamp-2 italic group-open:line-clamp-none">{plainText(item.text)}</span>
          </summary>
        </details>
      );

    case 'tool':
      return <ToolCard item={item} />;

    case 'rate_limited':
      return (
        <div className="animate-card-in rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn">
          <span className="font-medium">Gemini rate limit.</span> Waiting {formatDuration(item.waitMs)} before retry {item.attempt}.
        </div>
      );

    case 'final_answer':
      return (
        <div className="animate-card-in rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
          <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">Agent claims it&apos;s done · unverified</div>
          <p className="line-clamp-4">{item.text}</p>
        </div>
      );

    case 'failed':
      return (
        <div className="animate-card-in rounded-lg border border-err/40 bg-err-soft px-3 py-2.5 text-sm text-err">
          <div className="mb-0.5 font-medium">{FAILURE_LABEL[item.outcome]}</div>
          <p className="break-words">{item.message}</p>
        </div>
      );

    case 'verification': {
      const ok = item.result.success;
      return (
        <div className={`animate-card-in rounded-lg border px-3 py-2.5 text-sm ${ok ? 'border-ok/40 bg-ok-soft' : 'border-err/40 bg-err-soft'}`}>
          <div className={`mb-1.5 font-medium ${ok ? 'text-ok' : 'text-err'}`}>
            {ok ? 'Verified: the task really happened' : 'Verification failed'}
          </div>
          <ul className="space-y-1">
            {item.result.checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                <span className={c.passed ? 'text-ok' : 'text-err'} aria-label={c.passed ? 'passed' : 'failed'}>
                  {c.passed ? '✓' : '✗'}
                </span>
                <span>
                  {c.label}
                  {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }
}

const FAILURE_LABEL = {
  step_limit: 'Hit the step limit',
  timed_out: 'Ran out of time',
  error: 'Run failed',
  completed: 'Stopped',
} as const;

function ToolCard({ item }: { item: Extract<TimelineItem, { kind: 'tool' }> }) {
  const { toolkit, action } = describeTool(item.tool);
  const result = item.result;
  const tone = !result ? 'border-l-muted/50' : result.success ? 'border-l-ok' : 'border-l-err';

  return (
    <div className={`animate-card-in relative overflow-hidden rounded-lg border border-l-4 border-border bg-surface px-3 py-2.5 text-sm transition-shadow hover:shadow-sm ${tone}`}>
      {!result && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-surface-2" aria-hidden>
          <div className="animate-shimmer h-full w-1/2 bg-gradient-to-r from-transparent via-fg/50 to-transparent" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">{toolkit}</span>
        <span className="min-w-0 flex-1 truncate font-medium" title={item.tool}>
          {action}
        </span>
        {result ? (
          <span className={`shrink-0 font-mono text-xs ${result.success ? 'text-muted' : 'text-err'}`}>{formatDuration(result.durationMs)}</span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" /> running
          </span>
        )}
      </div>

      {result?.error && <p className="mt-1.5 break-words rounded bg-err-soft px-2 py-1 font-mono text-xs text-err">{result.error}</p>}

      <details className="mt-1.5 text-xs">
        <summary className="cursor-pointer truncate font-mono text-muted">{argsPreview(item.args) || 'no arguments'}</summary>
        <pre className="mt-1.5 max-h-56 overflow-auto rounded bg-surface-2 p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(item.args, null, 2)}</pre>
        {result?.output && (
          <>
            <div className="mt-2 text-[11px] uppercase tracking-wide text-muted">Output (truncated)</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-2 p-2 font-mono text-[11px]">{result.output}</pre>
          </>
        )}
      </details>
    </div>
  );
}
