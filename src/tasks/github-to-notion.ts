import type { ToolExecutor } from '@/lib/instrument';
import type { VerificationCheck } from '@/lib/types';
import { racerLabel, type TaskContext, type TaskDefinition } from './types';
import {
  allText,
  callTool,
  collectObjects,
  findValue,
  isObject,
  isString,
  normalizeTitle,
  result,
  safely,
  VerificationError,
} from './verify-utils';

export const GITHUB_OWNER = 'composiohq';
export const GITHUB_REPO = 'composio';
/** A page in the demo workspace, shared with the Composio Notion connection. Racers write beneath it. */
export const NOTION_PARENT_TITLE = 'Agent Arena';

const ISSUES_REQUIRED = 3;
/** Issues opened mid-race shouldn't fail an honest run, so any 3 of the newest 5 count. */
const ISSUE_WINDOW = 5;

export function notionPageTitle(ctx: TaskContext): string {
  return `Arena Run ${ctx.runNumber} — ${racerLabel(ctx)}`;
}

export interface GithubIssue {
  number: number;
  title: string;
}

export const githubToNotion: TaskDefinition = {
  id: 'github-to-notion',
  title: 'GitHub issues to Notion',
  summary: `Summarize the 3 newest open issues in ${GITHUB_OWNER}/${GITHUB_REPO} into a new Notion page.`,
  difficulty: 'easy',
  toolkits: ['github', 'notion'],
  tools: ['GITHUB_LIST_REPOSITORY_ISSUES', 'NOTION_SEARCH_NOTION_PAGE', 'NOTION_CREATE_NOTION_PAGE'],

  prompt: (ctx) =>
    [
      `Find the three most recently created OPEN issues (not pull requests) in the GitHub repository ${GITHUB_OWNER}/${GITHUB_REPO}.`,
      `Then create a Notion page titled exactly "${notionPageTitle(ctx)}" as a sub-page of the existing Notion page titled "${NOTION_PARENT_TITLE}".`,
      `The page body must list each of the three issues with its number (formatted like #1234), its title, and a one-sentence summary.`,
      `When the page exists, reply with a short confirmation.`,
    ].join('\n'),

  verify: (ctx, execute) =>
    safely(async () => {
      const checks: VerificationCheck[] = [];

      const parentId = await findParentPageId(execute);
      const page = await findChildPage(execute, parentId, notionPageTitle(ctx));
      checks.push({
        label: `Page "${notionPageTitle(ctx)}" exists under "${NOTION_PARENT_TITLE}"`,
        passed: page !== null,
      });
      if (!page) return result(checks);

      const markdown = allText(await callTool(execute, 'NOTION_GET_PAGE_MARKDOWN', { page_id: page }));
      const recent = await fetchRecentIssues(execute, ISSUE_WINDOW);
      const mentioned = issuesMentioned(markdown, recent);
      checks.push({
        label: `Mentions ${ISSUES_REQUIRED} of the ${ISSUE_WINDOW} newest open issues`,
        passed: mentioned.length >= ISSUES_REQUIRED,
        detail: `found ${mentioned.map((i) => `#${i.number}`).join(', ') || 'none'} of ${recent.map((i) => `#${i.number}`).join(', ')}`,
      });
      return result(checks);
    }),
};

/** Ground truth straight from GitHub, newest first, pull requests excluded. */
export async function fetchRecentIssues(execute: ToolExecutor, count: number): Promise<GithubIssue[]> {
  const data = await callTool(execute, 'GITHUB_LIST_REPOSITORY_ISSUES', {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    state: 'open',
    sort: 'created',
    direction: 'desc',
    per_page: 30,
  });
  // The issues endpoint also returns PRs; their html_url contains /pull/.
  const issues = collectObjects(
    data,
    (o) => typeof o.number === 'number' && typeof o.html_url === 'string' && /\/issues\/\d+$/.test(o.html_url),
  );
  if (issues.length === 0) throw new VerificationError('GitHub returned no open issues to compare against');
  return issues.slice(0, count).map((o) => ({ number: o.number as number, title: String(o.title ?? '') }));
}

/** An issue counts as mentioned if its #number, issue URL, or (most of) its title appears. */
export function issuesMentioned(text: string, issues: GithubIssue[]): GithubIssue[] {
  const haystack = text.toLowerCase();
  return issues.filter((issue) => {
    const byNumber = new RegExp(`(#|/issues/)${issue.number}(?!\\d)`).test(haystack);
    const titleStem = issue.title.toLowerCase().slice(0, 40).trim();
    return byNumber || (titleStem.length >= 12 && haystack.includes(titleStem));
  });
}

async function findParentPageId(execute: ToolExecutor): Promise<string> {
  const data = await callTool(execute, 'NOTION_SEARCH_NOTION_PAGE', {
    query: NOTION_PARENT_TITLE,
    filter_property: 'object',
    filter_value: 'page',
  });
  const pages = collectObjects(data, (o) => o.object === 'page' && typeof o.id === 'string');
  const parent = pages.find((p) => normalizeTitle(pageTitle(p)) === normalizeTitle(NOTION_PARENT_TITLE));
  if (!parent) throw new VerificationError(`Notion parent page "${NOTION_PARENT_TITLE}" is not shared with the connection`);
  return parent.id as string;
}

/**
 * List the parent's child_page blocks rather than using search: Notion's search
 * index lags behind fresh writes, block children do not.
 */
async function findChildPage(execute: ToolExecutor, parentId: string, title: string): Promise<string | null> {
  const wanted = normalizeTitle(title);
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const data = await callTool(execute, 'NOTION_FETCH_BLOCK_CONTENTS', {
      block_id: parentId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const match = collectObjects(data, (o) => o.type === 'child_page' && isObject(o.child_page)).find(
      (b) => normalizeTitle(String((b.child_page as { title?: unknown }).title ?? '')) === wanted,
    );
    if (match) return match.id as string;

    cursor = findValue(data, 'next_cursor', isString);
    if (!cursor) return null;
  }
  return null;
}

/** A Notion page's title lives in whichever property has type "title". */
function pageTitle(page: Record<string, unknown>): string {
  const props = isObject(page.properties) ? Object.values(page.properties) : [];
  for (const prop of props) {
    if (isObject(prop) && prop.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t) => (isObject(t) ? String(t.plain_text ?? '') : '')).join('');
    }
  }
  return '';
}
