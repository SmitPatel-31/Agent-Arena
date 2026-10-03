import { eventsAfter, getRace } from '@/lib/db';
import { abortableSleep } from '@/lib/retry';
import { isTerminal, type RaceSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const POLL_MS = 400;
const HEARTBEAT_MS = 15_000;
/** A race whose runs never finish (e.g. the function was killed) is reported as done after this. */
const STALE_AFTER_MS = 8 * 60_000;

/**
 * Server-Sent Events for one race.
 *
 * The race itself runs in a different invocation (after() in POST /api/races), so there
 * is no shared memory to subscribe to on serverless. Instead this tails the events table
 * by id. Each message carries `id:`, so a dropped connection resumes from Last-Event-ID.
 * The same endpoint replays finished races: it drains stored events, then sends `done`.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/races/[id]/stream'>) {
  const { id } = await ctx.params;
  const initial = await getRace(id).catch(() => null);
  if (!initial) return new Response('Race not found', { status: 404 });

  const encoder = new TextEncoder();
  let cursor = Number(request.headers.get('last-event-id')) || 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const signal = request.signal;
      let lastWrite = Date.now();
      send('retry: 2000\n\n');

      try {
        while (!signal.aborted) {
          // Read status before events: if the race was already finished, every event it
          // will ever write is visible to the events query that follows.
          const race: RaceSummary = (await getRace(id)) ?? initial;
          const events = await eventsAfter(race, cursor);
          for (const event of events) {
            send(`id: ${event.id}\nevent: run\ndata: ${JSON.stringify(event)}\n\n`);
            cursor = event.id;
            lastWrite = Date.now();
          }

          const finished = isTerminal(race.runs.A.status) && isTerminal(race.runs.B.status);
          const stale = Date.now() - Date.parse(race.createdAt) > STALE_AFTER_MS;
          if (events.length === 0 && (finished || stale)) {
            send(`event: done\ndata: ${JSON.stringify({ race, interrupted: !finished })}\n\n`);
            break;
          }

          if (Date.now() - lastWrite > HEARTBEAT_MS) {
            send(': keep-alive\n\n');
            lastWrite = Date.now();
          }
          if (events.length === 0) await abortableSleep(POLL_MS, signal).catch(() => {});
        }
      } catch (error) {
        if (!signal.aborted) {
          send(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : 'Stream failed' })}\n\n`);
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
