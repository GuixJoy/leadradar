import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read .env.local by default — load it explicitly
// so `npm run db:generate|db:migrate|db:push|db:studio` just work.
config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
