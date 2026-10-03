import { Composio } from '@composio/core';
import { GoogleProvider } from '@composio/google';
import type { FunctionDeclaration } from '@google/genai';
import { getEnv } from './env';
import { sanitizeDeclarations } from './gemini-schema';
import type { ToolExecutor } from './instrument';

/**
 * Toolkit versions are pinned on purpose: `tools.execute` refuses to run against
 * "latest" without `dangerouslySkipVersionCheck`, and pinning means both racers
 * (and the verifier) see identical tool schemas for the whole demo.
 * Discover current versions with `composio execute <SLUG> --get-schema`.
 */
export const TOOLKIT_VERSIONS = {
  github: '20260924_00',
  notion: '20260915_00',
  slack: '20261002_00',
  gmail: '20260915_00',
  googlecalendar: '20261001_00',
} as const;

export type ToolkitSlug = keyof typeof TOOLKIT_VERSIONS;

let client: Composio<GoogleProvider> | undefined;

export function getComposio(): Composio<GoogleProvider> {
  if (!client) {
    const env = getEnv();
    client = new Composio({
      apiKey: env.COMPOSIO_API_KEY,
      provider: new GoogleProvider(),
      toolkitVersions: { ...TOOLKIT_VERSIONS },
      allowTracking: false,
    });
  }
  return client;
}

/**
 * Gemini function declarations for an explicit list of tool slugs.
 * GoogleProvider passes JSON Schema keywords Gemini rejects (e.g. `examples`), so sanitize.
 */
export async function getToolDeclarations(slugs: readonly string[]): Promise<FunctionDeclaration[]> {
  const { COMPOSIO_USER_ID } = getEnv();
  return sanitizeDeclarations(await getComposio().tools.get(COMPOSIO_USER_ID, { tools: [...slugs] }));
}

/** Direct (non-model) execution against the demo user's connected accounts. */
export const executeTool: ToolExecutor = async (tool, args) => {
  const { COMPOSIO_USER_ID } = getEnv();
  const result = await getComposio().tools.execute(tool, { userId: COMPOSIO_USER_ID, arguments: args });
  return { successful: result.successful, data: result.data, error: result.error };
};
