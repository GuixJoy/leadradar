import { Pool } from 'pg';

// Singleton pool — safe for Next.js dev (HMR) + serverless.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => {
      console.error('[pg] pool error', err);
    });
  }
  return pool;
}

export async function pgQuery<T = any>(text: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const result = await getPool().query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length };
}
