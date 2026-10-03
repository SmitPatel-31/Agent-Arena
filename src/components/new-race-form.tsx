'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ModelOption } from '@/lib/models';
import type { Racer } from '@/lib/types';
import { RacerBadge } from './racer-badge';

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
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-muted">1. Pick a task</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((task) => {
            const active = task.id === taskId;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => setTaskId(task.id)}
                aria-pressed={active}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  active ? 'border-fg bg-surface shadow-sm' : 'border-border bg-surface/60 hover:border-muted'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{task.title}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs capitalize text-muted">{task.difficulty}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted">{task.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {task.toolkits.map((t) => (
                    <span key={t} className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-muted">2. Pick the racers</legend>
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          {(['A', 'B'] as const).map((racer, i) => (
            <div key={racer} className={i === 1 ? 'sm:order-3' : ''}>
              <label className="block rounded-xl border border-border bg-surface p-4">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <RacerBadge racer={racer} /> Racer {racer}
                </span>
                <select
                  value={picked[racer]}
                  onChange={(e) => setPicked((p) => ({ ...p, [racer]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:border-fg focus:outline-none"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}: {m.blurb}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <span className="text-center text-sm font-semibold text-muted sm:order-2">vs</span>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={start}
          disabled={submitting || !taskId}
          className="rounded-xl bg-fg px-6 py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Starting…' : 'Start race'}
        </button>
        <p className="text-xs text-muted">Each racer gets up to 15 steps and 3 minutes. Free-tier Gemini, so expect the odd rate-limit pause.</p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-err/40 bg-err-soft p-4 text-sm text-err">
          {error.message}{' '}
          {error.raceId && (
            <Link href={`/race/${error.raceId}`} className="font-medium underline">
              Watch it live
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
