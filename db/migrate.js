// npm run db:migrate — applies db/schema.sql using DATABASE_URL (pg).
// Usage: DATABASE_URL=... npm run db:migrate
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local and set it.');
    process.exit(1);
  }
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('[db:migrate] schema applied OK');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[db:migrate] failed:', e.message);
  process.exit(1);
});
