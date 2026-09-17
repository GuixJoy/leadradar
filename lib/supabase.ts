import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Optional: Supabase is only needed for realtime + legacy mode.
// Plain Postgres (DATABASE_URL) works without it — see lib/db/*.
// We intentionally do NOT throw here so open-source PG-only setups boot fine.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] env vars missing — running in PG-only mode (no realtime). Set NEXT_PUBLIC_SUPABASE_URL + key to enable realtime.')
}

// Dummy URL/key keep the client constructible in PG-only mode; every call
// site must guard with isSupabaseConfigured() / isSupabaseClientEnabled().
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'pg-only-no-key'
)
