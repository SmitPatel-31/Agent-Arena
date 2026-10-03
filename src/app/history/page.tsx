import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/page-header';
import { formatDuration, timeAgo } from '@/components/race/format';
import { RacerBadge } from '@/components/racer-badge';
import { listRaces } from '@/lib/db';
import { modelLabel } from '@/lib/models';
import { decideWinner } from '@/lib/score';
import { isStale, isTerminal, type RaceSummary, type Racer } from '@/lib/types';
import { getTask } from '@/tasks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'History' };

export default async function HistoryPage() {
  const races = await listRaces(100);

  return (
    <div>
      <PageHeader eyebrow="Race log" title="History">
        Every race is stored with its full event stream, so any of them can be replayed exactly as it happened.
      </PageHeader>

      {races.length === 0 ? (
        <EmptyState
          title="No races yet"
          body="Start the first race and it will show up here with its result."
          action={<NewRaceLink />}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {races.map((race, i) => (
            <li key={race.id} className="animate-card-in border-b border-border last:border-0" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <RaceRow race={race} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RaceRow({ race }: { race: RaceSummary }) {
  const { A, B } = race.runs;
  const finished = isTerminal(A.status) && isTerminal(B.status) && A.verifiedSuccess !== null && B.verifiedSuccess !== null;
  const { winner } = finished ? decideWinner(A, B) : { winner: null };
  const interrupted = !finished && isStale(race.createdAt);

  return (
    <Link
      href={`/race/${race.id}`}
      className="group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:grid-cols-[4rem_1.2fr_2fr_auto] sm:px-5"
    >
      <span className="font-mono text-sm font-semibold tabular-nums text-muted">#{race.seq}</span>
      <div className="min-w-0">
        <div className="truncate font-medium">{getTask(race.taskId)?.title ?? race.taskId}</div>
        <div className="font-mono text-xs text-muted">{timeAgo(race.createdAt)}</div>
      </div>
      <div className="col-span-3 row-start-2 flex flex-col gap-1 sm:col-span-1 sm:row-start-auto">
        {(['A', 'B'] as const).map((r) => (
          <RunLine key={r} racer={r} race={race} isWinner={winner === r} />
        ))}
      </div>
      <div className="col-start-3 row-start-1 flex items-center gap-3 sm:col-start-auto sm:row-start-auto">
        {interrupted ? (
          <span className="rounded-full bg-warn-soft px-2.5 py-1 font-mono text-[11px] font-medium uppercase text-warn">Interrupted</span>
        ) : !finished ? (
          <span className="flex items-center gap-1.5 rounded-full bg-err-soft px-2.5 py-1 font-mono text-[11px] font-medium uppercase text-err">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-err" /> Live
          </span>
        ) : winner ? (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <RacerBadge racer={winner} /> wins
          </span>
        ) : (
          <span className="text-sm text-muted">No winner</span>
        )}
        <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

function RunLine({ racer, race, isWinner }: { racer: Racer; race: RaceSummary; isWinner: boolean }) {
  const run = race.runs[racer];
  return (
    <div className={`flex items-center gap-2 text-sm ${isWinner ? 'font-semibold' : ''}`}>
      <RacerBadge racer={racer} />
      <span className="min-w-0 flex-1 truncate">{modelLabel(run.model)}</span>
      <span className="font-mono text-xs text-muted tabular-nums">{formatDuration(run.durationMs)}</span>
      <span
        className={`w-4 text-center text-xs ${run.verifiedSuccess === null ? 'text-muted' : run.verifiedSuccess ? 'text-ok' : 'text-err'}`}
        aria-label={run.verifiedSuccess === null ? 'pending' : run.verifiedSuccess ? 'verified' : 'not verified'}
      >
        {run.verifiedSuccess === null ? '·' : run.verifiedSuccess ? '✓' : '✗'}
      </span>
    </div>
  );
}

function NewRaceLink() {
  return (
    <Link href="/" className="inline-flex rounded-xl bg-fg px-5 py-2.5 font-display font-semibold text-bg transition-opacity hover:opacity-90">
      Start a race →
    </Link>
  );
}
