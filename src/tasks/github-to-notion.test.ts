import { describe, expect, it } from 'vitest';
import type { ToolExecutor, ToolResponse } from '@/lib/instrument';
import { githubToNotion, issuesMentioned, notionPageTitle } from './github-to-notion';

const ctx = { racer: 'A' as const, runNumber: 12, startedAt: new Date() };
const PARENT_ID = 'parent-page-id';
const CHILD_ID = 'child-page-id';

const issue = (number: number, title: string) => ({
  number,
  title,
  html_url: `https://github.com/composiohq/composio/issues/${number}`,
  milestone: { number: 1, title: 'v1', html_url: 'https://github.com/composiohq/composio/milestone/1' },
});

const ok = (data: Record<string, unknown>): ToolResponse => ({ successful: true, data, error: null });

/** A fake Composio that mimics the nested envelopes real responses use. */
function fakeWorld(pageMarkdown: string | null, childTitle = notionPageTitle(ctx)): ToolExecutor {
  return async (tool, args) => {
    switch (tool) {
      case 'NOTION_SEARCH_NOTION_PAGE':
        return ok({
          response_data: {
            results: [
              { object: 'page', id: PARENT_ID, properties: { title: { type: 'title', title: [{ plain_text: 'Agent Arena' }] } } },
            ],
          },
        });
      case 'NOTION_FETCH_BLOCK_CONTENTS':
        expect(args.block_id).toBe(PARENT_ID);
        return ok({
          results: pageMarkdown === null ? [] : [{ id: CHILD_ID, type: 'child_page', child_page: { title: childTitle } }],
          next_cursor: null,
        });
      case 'NOTION_GET_PAGE_MARKDOWN':
        expect(args.page_id).toBe(CHILD_ID);
        return ok({ markdown: pageMarkdown ?? '' });
      case 'GITHUB_LIST_REPOSITORY_ISSUES':
        return ok({
          details: [
            issue(105, 'Tool router drops auth config'),
            // Pull requests come back from the issues endpoint too and must be ignored.
            { number: 104, title: 'feat: new provider', html_url: 'https://github.com/composiohq/composio/pull/104' },
            issue(103, 'Gemini provider schema mismatch'),
            issue(102, 'Docs: session example is outdated'),
            issue(101, 'Slack toolkit pagination bug'),
            issue(100, 'Notion markdown loses tables'),
            issue(99, 'Old issue outside the window'),
          ],
        });
      default:
        throw new Error(`unexpected tool ${tool}`);
    }
  };
}

describe('githubToNotion.verify', () => {
  it('passes when the labeled page mentions three of the newest issues', async () => {
    const md = '# Arena Run 12\n- #105 Tool router drops auth config\n- #103 schema mismatch\n- #102 docs outdated';
    const verdict = await githubToNotion.verify(ctx, fakeWorld(md));
    expect(verdict.success).toBe(true);
    expect(verdict.checks[1].detail).toContain('#105, #103, #102');
  });

  it('accepts a hyphen where the title uses an em dash', async () => {
    const md = '#105 #103 #102';
    const verdict = await githubToNotion.verify(ctx, fakeWorld(md, 'Arena Run 12 - Racer A'));
    expect(verdict.success).toBe(true);
  });

  it('fails when the page is missing', async () => {
    const verdict = await githubToNotion.verify(ctx, fakeWorld(null));
    expect(verdict.success).toBe(false);
    expect(verdict.checks).toHaveLength(1);
  });

  it("fails when the page belongs to the other racer", async () => {
    const verdict = await githubToNotion.verify(ctx, fakeWorld('#105 #103 #102', 'Arena Run 12 — Racer B'));
    expect(verdict.success).toBe(false);
  });

  it('fails when too few recent issues are mentioned', async () => {
    const verdict = await githubToNotion.verify(ctx, fakeWorld('#105 and #99 and a pull request #104'));
    expect(verdict.success).toBe(false);
    expect(verdict.checks[1].detail).toContain('found #105');
  });

  it('reports infrastructure failures as a failed check instead of throwing', async () => {
    const broken: ToolExecutor = async () => ({ successful: false, data: {}, error: 'connection expired' });
    const verdict = await githubToNotion.verify(ctx, broken);
    expect(verdict.success).toBe(false);
    expect(verdict.checks[0].detail).toContain('connection expired');
  });
});

describe('issuesMentioned', () => {
  const issues = [
    { number: 12, title: 'Short' },
    { number: 123, title: 'A reasonably long issue title about retries' },
  ];

  it('does not match #12 inside #123', () => {
    expect(issuesMentioned('see #123', issues).map((i) => i.number)).toEqual([123]);
  });

  it('matches by title stem or issue URL', () => {
    expect(issuesMentioned('a reasonably long issue title about retries', issues).map((i) => i.number)).toEqual([123]);
    expect(issuesMentioned('https://github.com/o/r/issues/12', issues).map((i) => i.number)).toEqual([12]);
  });
});
