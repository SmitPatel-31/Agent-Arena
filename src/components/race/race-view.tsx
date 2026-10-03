'use client';

import Link from 'next/link';
import { modelLabel } from '@/lib/models';
import { decideWinner } from '@/lib/score';
import type { RaceSummary } from '@/lib/types';
import { RacerBadge } from '../racer-badge';
import { RacerPane } from './racer-pane';
import { Scorecard } from './scorecard';
import { StartLights } from './start-lights';
import { TelemetryStrip } from './telemetry-strip';
import { useRaceStream, type Connection } from './use-race-stream';

const CONNECTION: Record<Connection, { label: string; dot: string }> = {
  connecting: { label: 'Connecting', dot: 'bg-muted' },
  live: { label: 'Live', dot: 'bg-err animate-pulse' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warn animate-pulse' },
  done: { label: 'Final', dot: 'bg-muted' },
  failed: { label: 'Disconnected', dot: 'bg-err' },
};

// While live, both panes fill the viewport; once finished the scorecard sits on top and the page scrolls.
export function RaceView({ race, taskTitle }: { race: RaceSummary; taskTitle: string }) {
  const { state, final, connection, error } = useRaceStream(race.id);
  const winner = final ? decideWinner(final.race.runs.A, final.race.runs.B).winner : null;
  const conn = CONNECTION[connection];

  return (
    <div className={`flex flex-col gap-4 ${final ? '' : 'lg:h-[calc(100vh-8rem)]'}`}>
      <StartLights createdAt={race.createdAt} />

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link href="/history" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg">
            All races
          </Link>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-x-3 font-display text-2xl font-bold tracking-tight">
            Run #{race.seq}
            <span className="text-base font-medium text-muted">{taskTitle}</span>
          </h1>
        </div>
        <div className="hidden items-center gap-2 text-sm md:flex">
          <RacerBadge racer="A" /> <span className="font-medium">{modelLabel(race.runs.A.model)}</span>
          <span className="px-1 font-display text-xs font-bold italic text-muted">vs</span>
          <RacerBadge racer="B" /> <span className="font-medium">{modelLabel(race.runs.B.model)}</span>
        </div>
        <span className="ml-auto flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider">
          <span className={`h-2 w-2 rounded-full ${conn.dot}`} /> {conn.label}
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-err/40 bg-err-soft px-3 py-2 text-sm text-err">
          Live updates hit a problem: {error}. Reload to resume from where it stopped.
        </div>
      )}

      {final && <Scorecard race={final.race} modelLabel={modelLabel} interrupted={final.interrupted} />}

      <TelemetryStrip state={state} live={!final} />

      <div className={`grid min-h-0 flex-1 gap-4 lg:grid-cols-2 [&>section]:h-[70vh] ${final ? '' : 'lg:[&>section]:h-auto'}`}>
        {(['A', 'B'] as const).map((racer) => (
          <RacerPane
            key={racer}
            racer={racer}
            modelLabel={modelLabel(race.runs[racer].model)}
            state={state[racer]}
            isWinner={winner === racer}
            finalDurationMs={final?.race.runs[racer].durationMs ?? null}
          />
        ))}
      </div>
    </div>
  );
}
