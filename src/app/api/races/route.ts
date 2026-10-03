import { after, NextResponse } from 'next/server';
import { createRace, findActiveRace } from '@/lib/db';
import { isKnownModel } from '@/lib/models';
import { runRace } from '@/lib/race';
import { errorMessage } from '@/lib/retry';
import { getTask } from '@/tasks';

// The race keeps running inside after() once the response is sent: 3 min agent cap + verification.
export const maxDuration = 300;

interface StartRaceBody {
  taskId: string;
  modelA: string;
  modelB: string;
}

function parseBody(body: unknown): StartRaceBody | string {
  if (typeof body !== 'object' || body === null) return 'Expected a JSON body';
  const { taskId, modelA, modelB } = body as Record<string, unknown>;
  if (typeof taskId !== 'string' || !getTask(taskId)) return 'Unknown task';
  if (typeof modelA !== 'string' || !isKnownModel(modelA)) return 'Unknown model for Racer A';
  if (typeof modelB !== 'string' || !isKnownModel(modelB)) return 'Unknown model for Racer B';
  return { taskId, modelA, modelB };
}

export async function POST(request: Request) {
  const parsed = parseBody(await request.json().catch(() => null));
  if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 });

  try {
    // Both racers share one free-tier Gemini quota and one set of demo accounts: one race at a time.
    const active = await findActiveRace();
    if (active) {
      return NextResponse.json({ error: 'A race is already in progress.', raceId: active }, { status: 409 });
    }

    const race = await createRace(parsed);
    after(async () => {
      try {
        await runRace(race.id);
      } catch (error) {
        console.error(`[race ${race.id}] crashed:`, error);
      }
    });
    return NextResponse.json({ raceId: race.id, seq: race.seq }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/races]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
