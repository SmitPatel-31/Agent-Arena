import { describe, expect, it } from 'vitest';
import { compactForModel } from './compact';

describe('compactForModel', () => {
  it('strips API noise from a GitHub-style issue but keeps what a model needs', () => {
    const issue = {
      number: 4744,
      title: 'CLI execute should fail',
      body: 'details',
      html_url: 'https://github.com/composiohq/composio/issues/4744',
      url: 'https://api.github.com/repos/composiohq/composio/issues/4744',
      comments_url: 'https://api.github.com/…/comments',
      node_id: 'I_kwDO',
      user: { login: 'octocat', id: 1, type: 'User', avatar_url: 'https://…' },
      labels: [{ name: 'bug', color: 'red', url: 'https://…' }],
      assignees: [],
      milestone: null,
      reactions: { '+1': 0, total_count: 0 },
    };

    expect(compactForModel({ issues: [issue] })).toEqual({
      issues: [{ number: 4744, title: 'CLI execute should fail', body: 'details', html_url: 'https://github.com/composiohq/composio/issues/4744', user: 'octocat', labels: [{ name: 'bug', color: 'red' }] }],
    });
  });

  it('caps long strings', () => {
    expect(compactForModel({ body: 'x'.repeat(1000) })).toEqual({ body: `${'x'.repeat(800)}… [200 more chars]` });
  });

  it('passes primitives through', () => {
    expect(compactForModel('x')).toBe('x');
    expect(compactForModel(3)).toBe(3);
  });
});
