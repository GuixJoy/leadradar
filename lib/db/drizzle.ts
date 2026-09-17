import { drizzle } from 'drizzle-orm/node-postgres';
import { getPool } from './pg';
import * as schema from '@/db/schema';

// Drizzle client singleton over the shared pg Pool.
// Only used when DATABASE_URL is set (pg provider); Supabase mode
// keeps using @supabase/supabase-js via lib/db/store.ts.
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}
