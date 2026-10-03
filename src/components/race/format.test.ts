import { describe, expect, it } from 'vitest';
import { argsPreview, describeTool, formatDuration } from './format';

describe('describeTool', () => {
  it('splits toolkit and action and drops the repeated toolkit name', () => {
    expect(describeTool('GITHUB_LIST_REPOSITORY_ISSUES')).toEqual({ toolkit: 'GitHub', action: 'List repository issues' });
    expect(describeTool('NOTION_CREATE_NOTION_PAGE')).toEqual({ toolkit: 'Notion', action: 'Create page' });
    expect(describeTool('GOOGLECALENDAR_CREATE_EVENT')).toEqual({ toolkit: 'Calendar', action: 'Create event' });
  });
});

describe('formatDuration', () => {
  it('scales units', () => {
    expect(formatDuration(850)).toBe('850ms');
    expect(formatDuration(5_800)).toBe('5.8s');
    expect(formatDuration(95_000)).toBe('1m 35s');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('argsPreview', () => {
  it('shortens long values', () => {
    expect(argsPreview({ owner: 'composiohq', per_page: 10 })).toBe('owner=composiohq  per_page=10');
    expect(argsPreview({ markdown: 'x'.repeat(50) })).toBe(`markdown=${'x'.repeat(28)}…`);
  });
});
