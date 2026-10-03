import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/page-header';
import { formatDuration } from '@/components/race/format';
import { listRaces } from '@/lib/db';
import { modelLabel } from '@/lib/models';
import { leaderboard } from '@/lib/score';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leaderboard' };

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function LeaderboardPage() {
  const rows = leaderboard(await listRaces(1000));

  return (
    <div>
      <PageHeader eyebrow="Standings" title="Leaderboard">
        Ranked by win rate across finished races. A win needs a verified result, so a model that claims success without doing the
        work scores nothing.
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          title="No finished races"
          body="Standings appear once a race has been run and verified."
          action={
            <Link href="/" className="inline-flex rounded-xl bg-fg px-5 py-2.5 font-display font-semibold text-bg hover:opacity-90">
              Start a race →
            </Link>
          }
        />
      ) : (
        <ol className="space-y-3">
          {rows.map((row, i) => (
            <li
              key={row.model}
              className="animate-card-in grid grid-cols-[2.5rem_1fr] items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[3rem_1.4fr_2fr_repeat(3,5.5rem)] sm:p-5"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className={`font-display text-3xl font-bold tabular-nums ${i === 0 ? 'text-racer-a' : 'text-muted'}`}>{i + 1}</span>
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-semibold tracking-tight">{modelLabel(row.model)}</div>
                <div className="font-mono text-xs text-muted">{row.races} races · {row.wins} wins</div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
                  <span>Win rate</span>
                  <span className="text-fg">{pct(row.winRate)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`animate-grow-x h-full rounded-full ${i === 0 ? 'bg-racer-a' : 'bg-fg/70'}`}
                    style={{ width: `${Math.max(2, row.winRate * 100)}%`, animationDelay: `${150 + i * 80}ms` }}
                  />
                </div>
              </div>
              <Stat label="Verified" value={pct(row.successRate)} />
              <Stat label="Avg steps" value={row.avgSteps.toFixed(1)} />
              <Stat label="Avg time" value={formatDuration(row.avgDurationMs)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-mono text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
