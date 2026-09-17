// DB provider detection.
// Priority: DATABASE_URL (plain Postgres, incl. Supabase pooling / self-hosted PG / Docker)
// Fallback: Supabase REST (NEXT_PUBLIC_SUPABASE_URL + keys) for realtime + legacy mode.
//
// For open-source: just set DATABASE_URL and GOOGLE_PLACES_API_KEY and you're done.
// Supabase envs are fully optional.

export type DbProvider = 'pg' | 'supabase';

export function isPgConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getServerProvider(): DbProvider {
  if (isPgConfigured()) return 'pg';
  if (isSupabaseConfigured()) return 'supabase';
  throw new Error(
    'No database configured. Set DATABASE_URL (plain Postgres) or NEXT_PUBLIC_SUPABASE_URL + keys.'
  );
}

// Client-side: browser can only use Supabase directly (realtime).
// In PG-only mode the client must talk to our /api/db/* routes instead.
export function isSupabaseClientEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
