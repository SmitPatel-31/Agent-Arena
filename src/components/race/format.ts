const TOOLKIT_NAMES: Record<string, string> = {
  GITHUB: 'GitHub',
  NOTION: 'Notion',
  SLACK: 'Slack',
  GMAIL: 'Gmail',
  GOOGLECALENDAR: 'Calendar',
};

/** "GITHUB_LIST_REPOSITORY_ISSUES" → { toolkit: "GitHub", action: "List repository issues" } */
export function describeTool(slug: string): { toolkit: string; action: string } {
  const [prefix, ...rest] = slug.split('_');
  const toolkit = TOOLKIT_NAMES[prefix] ?? prefix;
  const words = rest.filter((w, i) => !(i === 0 && w === prefix)).join(' ').toLowerCase();
  // NOTION_CREATE_NOTION_PAGE → "Create page": drop the repeated toolkit name.
  const action = words.replace(new RegExp(`\\b${prefix.toLowerCase()}\\b\\s*`, 'g'), '').trim();
  return { toolkit, action: action.charAt(0).toUpperCase() + action.slice(1) };
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function formatTokens(n: number | null | undefined): string {
  if (!n) return '0';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Gemini thought summaries come as light markdown; the timeline shows plain text. */
export function plainText(markdown: string): string {
  return markdown.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
}

/** One-line preview of tool arguments: key=value pairs, long values shortened. */
export function argsPreview(args: Record<string, unknown>, max = 90): string {
  const text = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, 28) + (v.length > 28 ? '…' : '') : JSON.stringify(v)}`)
    .join('  ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
