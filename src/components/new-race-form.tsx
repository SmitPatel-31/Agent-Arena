'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ModelOption } from '@/lib/models';
import type { Racer } from '@/lib/types';
import { racerColor } from './racer-badge';

export interface TaskOption {
  id: string;
  title: string;
  summary: string;
  difficulty: 'easy' | 'medium' | 'hard';
  toolkits: string[];
}

interface Props {
  tasks: TaskOption[];
  models: ModelOption[];
  defaults: Record<Racer, string>;
}

type SubmitError = { message: string; raceId?: string };

export function NewRaceForm({ tasks, models, defaults }: Props) {
  const router = useRouter();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '');
  const [picked, setPicked] = useState<Record<Racer, string>>(defaults);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, modelA: picked.A, modelB: picked.B }),
      });
      const body = (await res.json().catch(() => ({}))) as { raceId?: string; error?: string };
      if (res.ok && body.raceId) {
        router.push(`/race/${body.raceId}`);
        return;
      }
      setError({ message: body.error ?? `Could not start the race (HTTP ${res.status}).`, raceId: res.status === 409 ? body.raceId : undefined });
    } catch {
      setError({ message: 'Network error. Is the server running?' });
    }
    setSubmitting(false);
  }

  return (
    <section aria-label="Set up a race" className="overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_1px_0_var(--border),0_24px_48px_-24px_rgb(0_0_0/0.18)]">
      <div className="border-b border-border p-5 sm:p-6">
        <SectionLabel step="1" label="Choose the course" />
        <div role="radiogroup" aria-label="Task" className="mt-4 grid gap-3 md:grid-cols-2">
          {tasks.map((task) => {
            const active = task.id === taskId;
            return (
              <button
                key={task.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTaskId(task.id)}
                className={`group relative rounded-2xl border p-4 text-left transition-all duration-200 ${
                  active ? 'border-fg bg-bg/60' : 'border-border hover:-translate-y-0.5 hover:border-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-base font-semibold tracking-tight">{task.title}</span>
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      active ? 'border-fg bg-fg' : 'border-border'
                    }`}
                    aria-hidden
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-bg" />}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{task.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {task.toolkits.map((t) => (
                    <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">{task.difficulty}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <SectionLabel step="2" label="Line up the racers" />
        <div className="relative mt-4 grid gap-3 md:grid-cols-2 md:gap-10">
          {(['A', 'B'] as const).map((racer) => (
            <LaneCard key={racer} racer={racer} models={models} value={picked[racer]} onChange={(id) => setPicked((p) => ({ ...p, [racer]: id }))} />
          ))}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface font-display text-sm font-bold italic shadow-sm md:flex"
          >
            VS
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-bg/50 p-5 sm:flex-row sm:items-center sm:p-6">
        <button
          type="button"
          onClick={start}
          disabled={submitting || !taskId}
          className="group inline-flex items-center justify-center gap-3 rounded-xl bg-fg px-6 py-3.5 font-display text-base font-semibold text-bg transition-all hover:gap-4 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg/30 border-t-bg" aria-hidden /> Lining up…
            </>
          ) : (
            <>
              Start race <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </>
          )}
        </button>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted">
          <div className="flex gap-1.5"><dt>Steps</dt><dd className="text-fg">15 max</dd></div>
          <div className="flex gap-1.5"><dt>Clock</dt><dd className="text-fg">3 min</dd></div>
          <div className="flex gap-1.5"><dt>Tier</dt><dd className="text-fg">free, expect rate-limit pauses</dd></div>
        </dl>
      </div>

      {error && (
        <div role="alert" className="animate-card-in border-t border-err/30 bg-err-soft px-6 py-3 text-sm text-err">
          {error.message}{' '}
          {error.raceId && (
            <Link href={`/race/${error.raceId}`} className="font-semibold underline underline-offset-2">
              Watch it live →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function SectionLabel({ step, label }: { step: string; label: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-sm font-medium">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fg font-mono text-[10px] text-bg">{step}</span>
      {label}
    </h2>
  );
}

/** A lane in the starting grid: the chosen model reads big, a native select keeps it accessible. */
function LaneCard({ racer, models, value, onChange }: { racer: Racer; models: ModelOption[]; value: string; onChange: (id: string) => void }) {
  const model = models.find((m) => m.id === value) ?? models[0];
  const color = racerColor[racer];
  const id = `racer-${racer}`;
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border transition-shadow focus-within:ring-2 focus-within:ring-fg ${racer === 'B' ? 'md:text-right' : ''}`}>
      <div className={`h-1.5 ${color.bg}`} aria-hidden />
      <div className={`p-4 ${color.soft}`}>
        <label htmlFor={id} className={`font-mono text-[11px] font-medium uppercase tracking-[0.16em] ${color.text}`}>
          Lane {racer}
        </label>
        <div className="mt-2 font-display text-2xl font-bold tracking-tight">{model.label}</div>
        <div className="mt-0.5 text-sm text-muted">{model.blurb}</div>
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium text-muted transition-colors group-hover:text-fg ${racer === 'B' ? 'md:justify-end' : ''}`}>
          Change model <span aria-hidden>▾</span>
        </div>
      </div>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}: {m.blurb}
          </option>
        ))}
      </select>
    </div>
  );
}
