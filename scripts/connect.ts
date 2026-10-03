/**
 * Connect a toolkit for the demo user (COMPOSIO_USER_ID) via Composio managed OAuth.
 *   npm run connect -- notion
 *
 * Uses connectedAccounts.link() rather than toolkits.authorize(): as of SDK 0.22 the
 * latter calls an endpoint the API rejects for Composio-managed OAuth (see FRICTION_LOG.md).
 */
import { getComposio, TOOLKIT_VERSIONS, type ToolkitSlug } from '@/lib/composio';
import { getEnv } from '@/lib/env';

async function authConfigFor(toolkit: ToolkitSlug): Promise<string> {
  const composio = getComposio();
  const existing = await composio.authConfigs.list({ toolkit });
  const enabled = existing.items.find((c) => c.status === 'ENABLED');
  if (enabled) return enabled.id;

  const created = await composio.authConfigs.create(toolkit, { type: 'use_composio_managed_auth', name: `Agent Arena ${toolkit}` });
  return created.id;
}

async function main() {
  const toolkit = process.argv[2] as ToolkitSlug | undefined;
  const valid = Object.keys(TOOLKIT_VERSIONS);
  if (!toolkit || !valid.includes(toolkit)) {
    throw new Error(`Usage: npm run connect -- <${valid.join('|')}>`);
  }

  const { COMPOSIO_USER_ID } = getEnv();
  const authConfigId = await authConfigFor(toolkit);
  const request = await getComposio().connectedAccounts.link(COMPOSIO_USER_ID, authConfigId);
  console.log(`\nOpen this URL to connect ${toolkit} for "${COMPOSIO_USER_ID}" (auth config ${authConfigId}):\n\n  ${request.redirectUrl}\n`);
  console.log('Waiting up to 15 minutes for you to finish…');
  const account = await request.waitForConnection(15 * 60_000);
  console.log(`Connected: ${account.id} (${account.status})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
