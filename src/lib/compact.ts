/**
 * Shrinks tool output before it enters the model's context.
 *
 * Provider payloads are mostly machine metadata: a single GitHub issue carries ~20
 * API URLs, node ids, avatars and reaction counters. Dropping that before the model
 * sees it cut a GitHub → Notion run from ~150k to a fraction of the input tokens,
 * which matters on free-tier per-minute token quotas. The UI and verifiers still
 * see the raw data; only the model gets the compact view.
 */

const NOISE_KEY = /(^|_)(url|urls|node_id|gravatar_id|avatar_url|etag|reactions|performed_via_github_app|sub_issues_summary|issue_dependencies_summary)$/;

/** Long free text (issue bodies, emails) is capped; the model needs the gist, not every line. */
const MAX_STRING = 800;

export function compactForModel(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… [${value.length - MAX_STRING} more chars]` : value;
  if (Array.isArray(value)) return value.map((v) => compactForModel(v, depth + 1));
  if (typeof value !== 'object' || value === null) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === null || child === '' || (NOISE_KEY.test(key) && key !== 'html_url')) continue;
    if (Array.isArray(child) && child.length === 0) continue;
    // People objects (user, assignee, closed_by…) only need the login.
    if (depth > 0 && isPerson(child)) {
      out[key] = child.login;
      continue;
    }
    out[key] = compactForModel(child, depth + 1);
  }
  return out;
}

function isPerson(value: unknown): value is { login: string } {
  return typeof value === 'object' && value !== null && 'login' in value && typeof (value as { login: unknown }).login === 'string' && 'type' in value;
}
