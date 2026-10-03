import { describe, expect, it } from 'vitest';
import type { ToolExecutor, ToolResponse } from '@/lib/instrument';
import { extractSubjects, gmailToCalendar, tomorrowIn } from './gmail-to-calendar';

// 2026-10-03 22:30 New York time is already 10-04 in UTC: "tomorrow" must follow New York.
const startedAt = new Date('2026-10-04T02:30:00Z');
const ctx = { racer: 'B' as const, runNumber: 9, startedAt };
const ok = (data: Record<string, unknown>): ToolResponse => ({ successful: true, data, error: null });
const SUBJECT = 'Arena Invite: Composio demo sync';

function fakeGoogle(events: { summary: string; start: { dateTime?: string; date?: string } }[]): ToolExecutor {
  return async (tool, args) => {
    if (tool === 'GMAIL_FETCH_EMAILS') return ok({ messages: [{ messageId: 'm1', subject: SUBJECT, sender: 'pm@example.com' }] });
    if (tool === 'GOOGLECALENDAR_EVENTS_LIST') {
      expect(args.timeZone).toBe('America/New_York');
      return ok({ items: events });
    }
    throw new Error(`unexpected ${tool}`);
  };
}

describe('tomorrowIn', () => {
  it('uses the arena timezone, not UTC', () => {
    expect(tomorrowIn('America/New_York', startedAt)).toBe('2026-10-04');
  });
});

describe('gmailToCalendar.verify', () => {
  it('passes for a correctly titled event at 10:00 tomorrow', async () => {
    const verdict = await gmailToCalendar.verify(
      ctx,
      fakeGoogle([{ summary: `[Racer B, Run 9] ${SUBJECT}`, start: { dateTime: '2026-10-04T10:00:00-04:00' } }]),
    );
    expect(verdict.success).toBe(true);
  });

  it('fails when the time is wrong or the subject is missing', async () => {
    const wrongTime = await gmailToCalendar.verify(ctx, fakeGoogle([{ summary: `[Racer B, Run 9] ${SUBJECT}`, start: { dateTime: '2026-10-04T14:00:00-04:00' } }]));
    expect(wrongTime.success).toBe(false);

    const noSubject = await gmailToCalendar.verify(ctx, fakeGoogle([{ summary: '[Racer B, Run 9] Meeting', start: { dateTime: '2026-10-04T10:00:00-04:00' } }]));
    expect(noSubject.success).toBe(false);
  });

  it("does not accept the other racer's event", async () => {
    const verdict = await gmailToCalendar.verify(ctx, fakeGoogle([{ summary: `[Racer A, Run 9] ${SUBJECT}`, start: { dateTime: '2026-10-04T10:00:00-04:00' } }]));
    expect(verdict.success).toBe(false);
    expect(verdict.checks).toHaveLength(1);
  });
});

describe('extractSubjects', () => {
  it('reads a subject field or falls back to raw headers', () => {
    expect(extractSubjects({ messages: [{ subject: 'A' }] })).toEqual(['A']);
    expect(extractSubjects({ payload: { headers: [{ name: 'From', value: 'x' }, { name: 'Subject', value: 'B' }] } })).toEqual(['B']);
  });
});
