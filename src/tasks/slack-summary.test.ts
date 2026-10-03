import { describe, expect, it } from 'vitest';
import type { ToolExecutor, ToolResponse } from '@/lib/instrument';
import { latestHumanMessage, sharedWords, slackSummary } from './slack-summary';

const startedAt = new Date('2026-10-03T12:00:00Z');
const ctx = { racer: 'A' as const, runNumber: 7, startedAt };
const ts = (offsetSec: number) => String(startedAt.getTime() / 1000 + offsetSec);
const ok = (data: Record<string, unknown>): ToolResponse => ({ successful: true, data, error: null });

const SOURCE = 'Reminder: the quarterly roadmap review moves to Thursday, bring your deployment metrics.';

function fakeSlack(messages: { ts: string; text: string }[]): ToolExecutor {
  return async (tool) => {
    if (tool === 'SLACK_FIND_CHANNELS') return ok({ channels: [{ id: 'C123', name: 'agent-arena' }] });
    if (tool === 'SLACK_FETCH_CONVERSATION_HISTORY') return ok({ response_data: { messages } });
    throw new Error(`unexpected ${tool}`);
  };
}

describe('slackSummary.verify', () => {
  it('passes for a tagged one-line summary that relates to the source message', async () => {
    const verdict = await slackSummary.verify(
      ctx,
      fakeSlack([
        { ts: ts(20), text: '[Racer A, Run 7] Roadmap review moved to Thursday; bring deployment metrics.' },
        { ts: ts(-600), text: SOURCE },
      ]),
    );
    expect(verdict.success).toBe(true);
    expect(verdict.checks.at(-1)?.detail).toContain('roadmap');
  });

  it("ignores the other racer's message", async () => {
    const verdict = await slackSummary.verify(ctx, fakeSlack([{ ts: ts(20), text: '[Racer B, Run 7] Roadmap review moved.' }, { ts: ts(-600), text: SOURCE }]));
    expect(verdict.success).toBe(false);
    expect(verdict.checks).toHaveLength(1);
  });

  it('rejects multi-line or unrelated summaries', async () => {
    const multi = await slackSummary.verify(ctx, fakeSlack([{ ts: ts(20), text: '[Racer A, Run 7] Roadmap review\nmoved to Thursday.' }, { ts: ts(-600), text: SOURCE }]));
    expect(multi.success).toBe(false);

    const unrelated = await slackSummary.verify(ctx, fakeSlack([{ ts: ts(20), text: '[Racer A, Run 7] Everything is great, nothing to report.' }, { ts: ts(-600), text: SOURCE }]));
    expect(unrelated.success).toBe(false);
  });

  it('does not count a tagged message from before the race', async () => {
    const verdict = await slackSummary.verify(ctx, fakeSlack([{ ts: ts(-3600), text: '[Racer A, Run 7] Roadmap review moved to Thursday.' }]));
    expect(verdict.success).toBe(false);
  });
});

describe('helpers', () => {
  it('latestHumanMessage skips racer posts, system notices and anything after the start', () => {
    const msgs = [
      { ts: ts(-5), text: '<@U1> has joined the channel', subtype: 'channel_join' },
      { ts: ts(-10), text: '[Racer B, Run 6] old summary' },
      { ts: ts(-60), text: SOURCE },
      { ts: ts(5), text: 'posted during the race' },
    ];
    expect(latestHumanMessage(msgs, startedAt)?.text).toBe(SOURCE);
  });

  it('sharedWords ignores short words and stopwords', () => {
    expect(sharedWords('The roadmap review is today', 'Review the roadmap today')).toEqual(['roadmap', 'review']);
  });
});
