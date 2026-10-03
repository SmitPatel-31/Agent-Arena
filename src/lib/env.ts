/** Typed access to server env vars. Fails loudly at first use instead of deep inside an SDK call. */

const REQUIRED = [
  'COMPOSIO_API_KEY',
  'GEMINI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type RequiredKey = (typeof REQUIRED)[number];

export interface Env extends Record<RequiredKey, string> {
  COMPOSIO_USER_ID: string;
}

export class MissingEnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env.local and fill them in.`);
    this.name = 'MissingEnvError';
  }
}

export function getEnv(): Env {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new MissingEnvError(missing);

  return {
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY!,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    COMPOSIO_USER_ID: process.env.COMPOSIO_USER_ID || 'arena-demo',
  };
}
