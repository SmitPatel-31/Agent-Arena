-- Agent Arena schema. Paste into the Supabase SQL editor and run once.
-- Only the server (service role key) touches these tables, so RLS is enabled with no policies:
-- the anon key can read nothing.

create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  -- Human-friendly run number used in racer-labeled artifacts ("Arena Run 12 — Racer A").
  seq bigint generated always as identity unique,
  task_id text not null,
  model_a text not null,
  model_b text not null,
  created_at timestamptz default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  race_id uuid references races(id) on delete cascade,
  racer text not null check (racer in ('A','B')),
  model text not null,
  status text not null default 'running',
  verified_success boolean,
  steps int default 0,
  tool_errors int default 0,
  duration_ms int,
  input_tokens int,
  output_tokens int,
  final_answer text,
  unique (race_id, racer)
);

create table if not exists events (
  id bigserial primary key,
  run_id uuid references runs(id) on delete cascade,
  type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists events_run_id_id_idx on events (run_id, id);
create index if not exists runs_race_id_idx on runs (race_id);
create index if not exists races_created_at_idx on races (created_at desc);

alter table races enable row level security;
alter table runs enable row level security;
alter table events enable row level security;
