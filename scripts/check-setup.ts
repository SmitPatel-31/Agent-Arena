/**
 * One command to answer "why doesn't my race work?":
 *   env vars, Supabase tables, Composio connections per toolkit, and which Gemini models answer.
 *   npm run check
 */
import { createClient } from '@supabase/supabase-js';
import { getComposio, TOOLKIT_VERSIONS } from '@/lib/composio';
import { getEnv } from '@/lib/env';
import { getGemini } from '@/lib/gemini';
import { MODELS } from '@/lib/models';
import { errorMessage } from '@/lib/retry';

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => console.log(`  ✗ ${msg}`);

async function main() {
  const env = getEnv();
  ok('environment variables present');

  console.log('\nSupabase');
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const table of ['races', 'runs', 'events']) {
    const { error } = await db.from(table).select('*').limit(1);
    if (error) bad(`${table}: ${error.message} (run supabase/schema.sql)`);
    else ok(`table ${table}`);
  }

  console.log(`\nComposio connections for "${env.COMPOSIO_USER_ID}"`);
  try {
    const accounts = await getComposio().connectedAccounts.list({ userIds: [env.COMPOSIO_USER_ID] });
    for (const toolkit of Object.keys(TOOLKIT_VERSIONS)) {
      const active = accounts.items.find((a) => a.toolkit.slug === toolkit && a.status === 'ACTIVE');
      if (active) ok(`${toolkit} (${active.id})`);
      else bad(`${toolkit} not connected — npm run connect -- ${toolkit}`);
    }
  } catch (error) {
    bad(`Composio: ${errorMessage(error).slice(0, 200)}`);
  }

  console.log('\nGemini models (one tiny request each)');
  for (const model of MODELS) {
    try {
      await getGemini().models.generateContent({ model: model.id, contents: 'Reply with OK.' });
      ok(model.id);
    } catch (error) {
      bad(`${model.id}: ${errorMessage(error).slice(0, 160)}`);
    }
  }
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
