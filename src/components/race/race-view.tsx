'use client';

import { decideWinner } from '@/lib/score';
import { modelLabel } from '@/lib/models';
import type { RaceSummary } from '@/lib/types';
import { RacerPane } from './racer-pane';
import { Scorecard } from './scorecard';
import { useRaceStream, type Connection } from './use-race-stream';

const CONNECTION: Record<Connection, { label: string; dot: string }> = {
  connecting: { label: 'Connecting', dot: 'bg-muted' },
  live: { label: 'Live', dot: 'bg-ok animate-pulse' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warn animate-pulse' },
  done: { label: 'Finished', dot: 'bg-muted' },
  failed: { label: 'Disconnected', dot: 'bg-err' },
};

// While live, both panes fill the viewport; once finished the scorecard sits on top and the page scrolls.
export function RaceView({ race, taskTitle }: { race: RaceSummary; taskTitle: string }) {
  const { state, final, connection, error } = useRaceStream(race.id);
  const winner = final ? decideWinner(final.race.runs.A, final.race.runs.B).winner : null;
  const conn = CONNECTION[connection];

  return (
    <div className={`flex flex-col gap-4 ${final ? '' : 'lg:h-[calc(100vh-7.5rem)]'}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Run #{race.seq}</h1>
        <span className="text-muted">{taskTitle}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${conn.dot}`} /> {conn.label}
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-err/40 bg-err-soft px-3 py-2 text-sm text-err">
          Live updates hit a problem: {error}. Reload to resume from where it stopped.
        </div>
      )}

      {final && <Scorecard race={final.race} modelLabel={modelLabel} interrupted={final.interrupted} />}

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
