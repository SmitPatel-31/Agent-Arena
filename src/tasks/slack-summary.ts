import type { ToolExecutor } from '@/lib/instrument';
import type { VerificationCheck } from '@/lib/types';
import { runTag, type TaskDefinition } from './types';
import { callTool, collectObjects, isString, result, safely, VerificationError } from './verify-utils';

/** A channel in the demo workspace. Someone (not a racer) posts the message to summarize. */
export const SLACK_CHANNEL = 'agent-arena';

const RACER_PREFIX = /^\s*\[racer\s/i;
const MIN_SUMMARY_CHARS = 15;

export interface SlackMessage {
  ts: string;
  text: string;
}

export const slackSummary: TaskDefinition = {
  id: 'slack-summary',
  title: 'Slack channel summary',
  summary: `Read the latest message in #${SLACK_CHANNEL} and post a one-line summary back to the channel.`,
  difficulty: 'medium',
  toolkits: ['slack'],
  tools: ['SLACK_FIND_CHANNELS', 'SLACK_FETCH_CONVERSATION_HISTORY', 'SLACK_SEND_MESSAGE'],

  prompt: (ctx) =>
    [
      `In Slack, find the channel #${SLACK_CHANNEL}.`,
      `Read the most recent message in it that was NOT written by a racer. Ignore every message that starts with "[Racer".`,
      `Post ONE new message to #${SLACK_CHANNEL}: a single-line summary of that message, starting exactly with "${runTag(ctx)} ".`,
      `Do not reply in a thread, do not edit or react to other messages. When it is posted, reply with a short confirmation.`,
    ].join('\n'),

  verify: (ctx, execute) =>
    safely(async () => {
      const checks: VerificationCheck[] = [];
      const channelId = await findChannelId(execute);
      const messages = await fetchMessages(execute, channelId);

      const tag = normalize(runTag(ctx));
      const posted = messages.find((m) => normalize(m.text).startsWith(tag) && Number(m.ts) * 1000 >= ctx.startedAt.getTime() - 5_000);
      checks.push({ label: `Message starting with "${runTag(ctx)}" posted in #${SLACK_CHANNEL}`, passed: Boolean(posted) });
      if (!posted) return result(checks);

      const body = posted.text.trim().slice(runTag(ctx).length).trim();
      checks.push({
        label: 'Summary is a single non-trivial line',
        passed: !body.includes('\n') && body.length >= MIN_SUMMARY_CHARS,
        detail: `${body.length} chars`,
      });

      const source = latestHumanMessage(messages, ctx.startedAt);
      if (source) {
        const shared = sharedWords(source.text, body);
        checks.push({
          label: 'Summary relates to the latest non-racer message',
          passed: shared.length > 0,
          detail: shared.length ? `shares "${shared.slice(0, 3).join('", "')}"` : 'no words in common',
        });
      }
      return result(checks);
    }),
};

async function findChannelId(execute: ToolExecutor): Promise<string> {
  const data = await callTool(execute, 'SLACK_FIND_CHANNELS', { query: SLACK_CHANNEL, exact_match: true });
  const channel = collectObjects(data, (o) => o.name === SLACK_CHANNEL && isString(o.id))[0];
  if (!channel) throw new VerificationError(`Slack channel #${SLACK_CHANNEL} not found`);
  return channel.id as string;
}

async function fetchMessages(execute: ToolExecutor, channel: string): Promise<SlackMessage[]> {
  const data = await callTool(execute, 'SLACK_FETCH_CONVERSATION_HISTORY', { channel, limit: 50 });
  return collectObjects(data, (o) => isString(o.ts) && typeof o.text === 'string').map((o) => ({ ts: o.ts as string, text: o.text as string }));
}

/** The message the racers were asked to summarize: newest from before the race, not from a racer. */
export function latestHumanMessage(messages: SlackMessage[], startedAt: Date): SlackMessage | undefined {
  return messages
    .filter((m) => Number(m.ts) * 1000 < startedAt.getTime() && !RACER_PREFIX.test(m.text) && m.text.trim().length > 0)
    .sort((a, b) => Number(b.ts) - Number(a.ts))[0];
}

const STOPWORDS = new Set(['about', 'after', 'again', 'there', 'their', 'these', 'those', 'which', 'would', 'should', 'could', 'where', 'while', 'today', 'please']);

/** Significant words (5+ letters, not stopwords) appearing in both texts. */
export function sharedWords(a: string, b: string): string[] {
  const words = (s: string) => new Set((s.toLowerCase().match(/[a-z][a-z0-9]{4,}/g) ?? []).filter((w) => !STOPWORDS.has(w)));
  const right = words(b);
  return [...words(a)].filter((w) => right.has(w));
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
