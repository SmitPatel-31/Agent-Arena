import type { ToolExecutor } from '@/lib/instrument';
import type { VerificationCheck } from '@/lib/types';
import { runTag, type TaskDefinition } from './types';
import { callTool, collectObjects, isObject, result, safely, VerificationError } from './verify-utils';

/** Subject keyword of the email the racers look for. Send yourself one in the demo inbox. */
export const EMAIL_KEYWORD = 'Arena Invite';
/** Racers get an explicit date, time and zone so "tomorrow" can't be misread and verification is exact. */
export const ARENA_TIMEZONE = 'America/New_York';
const START_TIME = '10:00';
const END_TIME = '10:30';

/** Tomorrow's date (YYYY-MM-DD) in the arena timezone, relative to the race start. */
export function tomorrowIn(timeZone: string, from: Date): string {
  const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow);
}

export const gmailToCalendar: TaskDefinition = {
  id: 'gmail-to-calendar',
  title: 'Gmail to Calendar',
  summary: `Find the latest "${EMAIL_KEYWORD}" email and book it as a calendar event for tomorrow.`,
  difficulty: 'hard',
  toolkits: ['gmail', 'googlecalendar'],
  tools: ['GMAIL_FETCH_EMAILS', 'GOOGLECALENDAR_CREATE_EVENT'],

  prompt: (ctx) => {
    const date = tomorrowIn(ARENA_TIMEZONE, ctx.startedAt);
    return [
      `In Gmail, find the most recent email whose subject contains "${EMAIL_KEYWORD}".`,
      `Create ONE event on the primary Google Calendar:`,
      `- title: exactly "${runTag(ctx)} " followed by that email's subject`,
      `- date: ${date}, from ${START_TIME} to ${END_TIME}, timezone ${ARENA_TIMEZONE}`,
      `- description: one sentence saying who sent the email`,
      `Do not add attendees and do not send invitations. When the event exists, reply with a short confirmation.`,
    ].join('\n');
  },

  verify: (ctx, execute) =>
    safely(async () => {
      const checks: VerificationCheck[] = [];
      const date = tomorrowIn(ARENA_TIMEZONE, ctx.startedAt);
      const subject = await latestKeywordSubject(execute);

      const events = await fetchEvents(execute, date);
      const tag = runTag(ctx).toLowerCase();
      const event = events.find((e) => e.summary.toLowerCase().startsWith(tag));
      checks.push({ label: `Event titled "${runTag(ctx)} …" exists on ${date}`, passed: Boolean(event) });
      if (!event) return result(checks);

      checks.push({
        label: 'Title includes the email subject',
        passed: squash(event.summary).includes(squash(subject)),
        detail: `subject "${subject}"`,
      });
      checks.push({
        label: `Starts at ${START_TIME} ${ARENA_TIMEZONE}`,
        passed: event.start.startsWith(`${date}T${START_TIME}`),
        detail: event.start || 'no start time',
      });
      return result(checks);
    }),
};

async function latestKeywordSubject(execute: ToolExecutor): Promise<string> {
  const data = await callTool(execute, 'GMAIL_FETCH_EMAILS', { query: `subject:"${EMAIL_KEYWORD}"`, max_results: 1 });
  const subject = extractSubjects(data)[0];
  if (!subject) throw new VerificationError(`No email with "${EMAIL_KEYWORD}" in the subject found in the demo inbox`);
  return subject;
}

/** Gmail results carry the subject either as a field or in the raw headers. */
export function extractSubjects(data: unknown): string[] {
  const direct = collectObjects(data, (o) => typeof o.subject === 'string' && (o.subject as string).length > 0).map((o) => o.subject as string);
  if (direct.length) return direct;
  return collectObjects(data, (o) => typeof o.name === 'string' && o.name.toLowerCase() === 'subject' && typeof o.value === 'string').map(
    (o) => o.value as string,
  );
}

interface CalendarEvent {
  summary: string;
  start: string;
}

async function fetchEvents(execute: ToolExecutor, date: string): Promise<CalendarEvent[]> {
  // Ask for times rendered in the arena zone so the start check is a plain string compare.
  const data = await callTool(execute, 'GOOGLECALENDAR_EVENTS_LIST', {
    calendarId: 'primary',
    timeMin: `${date}T00:00:00Z`,
    timeMax: `${date}T23:59:59Z`,
    timeZone: ARENA_TIMEZONE,
    singleEvents: true,
    maxResults: 100,
  });
  return collectObjects(data, (o) => typeof o.summary === 'string' && isObject(o.start)).map((o) => {
    const start = o.start as { dateTime?: unknown; date?: unknown };
    return { summary: o.summary as string, start: typeof start.dateTime === 'string' ? start.dateTime : '' };
  });
}

/** Lowercase and drop punctuation/space so "Re: Arena Invite — Sync" matches loosely re-typed titles. */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}
