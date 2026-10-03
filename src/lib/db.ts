import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { RaceSummary, Racer, RunEvent, RunStatus, RunSummary, StreamEvent } from './types';

/** Row shapes for the three tables in supabase/schema.sql. */
interface RaceRow {
  id: string;
  seq: number;
  task_id: string;
  model_a: string;
  model_b: string;
  created_at: string;
}

interface RunRow {
  id: string;
  race_id: string;
  racer: Racer;
  model: string;
  status: RunStatus;
  verified_success: boolean | null;
  steps: number;
  tool_errors: number;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  final_answer: string | null;
}

interface EventRow {
  id: number;
  run_id: string;
  type: RunEvent['type'];
  payload: RunEvent['payload'];
  created_at: string;
}

export type RunPatch = Partial<Omit<RunRow, 'id' | 'race_id' | 'racer' | 'model'>>;

let client: SupabaseClient | undefined;

/** Service-role client. Server only: this key bypasses RLS. */
function db(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export class DbError extends Error {
  constructor(operation: string, message: string) {
    super(`Database ${operation} failed: ${message}`);
    this.name = 'DbError';
  }
}

function unwrap<T>(operation: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new DbError(operation, res.error.message);
  if (res.data === null) throw new DbError(operation, 'no data returned');
  return res.data;
}

export async function createRace(input: { taskId: string; modelA: string; modelB: string }): Promise<RaceSummary> {
  const race = unwrap<RaceRow>(
    'create race',
    await db().from('races').insert({ task_id: input.taskId, model_a: input.modelA, model_b: input.modelB }).select().single(),
  );
  const runs = unwrap<RunRow[]>(
    'create runs',
    await db()
      .from('runs')
      .insert([
        { race_id: race.id, racer: 'A', model: input.modelA },
        { race_id: race.id, racer: 'B', model: input.modelB },
      ])
      .select(),
  );
  return toRaceSummary(race, runs);
}

export async function getRace(raceId: string): Promise<RaceSummary | null> {
  const res = await db().from('races').select('*, runs(*)').eq('id', raceId).maybeSingle();
  if (res.error) throw new DbError('get race', res.error.message);
  if (!res.data) return null;
  const { runs, ...race } = res.data as RaceRow & { runs: RunRow[] };
  return toRaceSummary(race, runs);
}

export async function listRaces(limit = 50): Promise<RaceSummary[]> {
  const rows = unwrap<(RaceRow & { runs: RunRow[] })[]>(
    'list races',
    await db().from('races').select('*, runs(*)').order('created_at', { ascending: false }).limit(limit),
  );
  return rows.filter((r) => r.runs.length === 2).map(({ runs, ...race }) => toRaceSummary(race, runs));
}

export async function updateRun(runId: string, patch: RunPatch): Promise<void> {
  const res = await db().from('runs').update(patch).eq('id', runId);
  if (res.error) throw new DbError('update run', res.error.message);
}

export async function insertEvent(runId: string, event: RunEvent): Promise<void> {
  const res = await db().from('events').insert({ run_id: runId, type: event.type, payload: event.payload });
  if (res.error) throw new DbError('insert event', res.error.message);
}

/** Events for a race after a cursor, oldest first, tagged with the racer. */
export async function eventsAfter(race: RaceSummary, afterId: number, limit = 200): Promise<StreamEvent[]> {
  const racerByRun = new Map<string, Racer>([
    [race.runs.A.id, 'A'],
    [race.runs.B.id, 'B'],
  ]);
  const rows = unwrap<EventRow[]>(
    'list events',
    await db()
      .from('events')
      .select('*')
      .in('run_id', [...racerByRun.keys()])
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(limit),
  );
  return rows.map(
    (row) => ({ id: row.id, racer: racerByRun.get(row.run_id)!, at: row.created_at, type: row.type, payload: row.payload }) as StreamEvent,
  );
}

function toRaceSummary(race: RaceRow, runs: RunRow[]): RaceSummary {
  const byRacer = (racer: Racer): RunSummary => {
    const run = runs.find((r) => r.racer === racer);
    if (!run) throw new DbError('load race', `race ${race.id} has no run for racer ${racer}`);
    return {
      id: run.id,
      racer,
      model: run.model,
      status: run.status,
      verifiedSuccess: run.verified_success,
      steps: run.steps ?? 0,
      toolErrors: run.tool_errors ?? 0,
      durationMs: run.duration_ms,
      inputTokens: run.input_tokens,
      outputTokens: run.output_tokens,
      finalAnswer: run.final_answer,
    };
  };
  return { id: race.id, seq: Number(race.seq), taskId: race.task_id, createdAt: race.created_at, runs: { A: byRacer('A'), B: byRacer('B') } };
}

/** A race still in flight (started recently, a run not yet terminal). Used to allow one race at a time. */
export async function findActiveRace(withinMs = 6 * 60_000): Promise<string | null> {
  const since = new Date(Date.now() - withinMs).toISOString();
  const res = await db()
    .from('runs')
    .select('race_id, races!inner(created_at)')
    .in('status', ['running', 'verifying'])
    .gte('races.created_at', since)
    .limit(1);
  if (res.error) throw new DbError('find active race', res.error.message);
  return (res.data?.[0] as { race_id: string } | undefined)?.race_id ?? null;
}
