# LeadRadar — Postgres setup (open-source, no Supabase required)

Supabase is **optional**. The server uses plain Postgres (via **Drizzle ORM**)
when `DATABASE_URL` is set, and only falls back to Supabase when it isn't.
Supabase _is_ Postgres, so the same Drizzle schema works on both.

## 1. Quickstart with Docker (recommended)

```bash
docker compose up -d
cp .env.example .env.local
# .env.local already contains:
# DATABASE_URL=postgresql://leadradar:leadradar@localhost:5433/leadradar
npm install
npm run db:migrate
npm run dev
```

Get a key from Google Cloud Console (Places API New + Maps JS + Street View Static):
```env
GOOGLE_PLACES_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

Open http://localhost:3000, check `/api/health` → `{"provider":"pg",...}`.

## 2. Managed Postgres (Neon / RDS / Supabase pooling)

```env
DATABASE_URL=postgresql://user:pass@host:5432/leadradar?sslmode=require
npm run db:migrate
```

For Supabase Postgres, use the **pooler** URL (port 6543) or direct (5432) from
Project Settings → Database. No Supabase JS keys needed in this mode.

## 3. Legacy Supabase mode (realtime)

If `DATABASE_URL` is **unset** and these are set, the app uses Supabase REST + realtime:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
Client realtime (`supabase.channel('live-leads')`) only activates in this mode.
In PG mode the client uses `/api/db/*` + 15s polling instead — no JS changes needed.

Set **both** to get PG storage + Supabase realtime (server prefers `DATABASE_URL`).

## 4. Schema & migrations (Drizzle)

- Source of truth: `db/schema.ts` (Drizzle `pg-core`, snake_case columns to match existing DBs).
- Generated migrations: `db/migrations/` — baseline `0000_*` creates all 4 tables + indexes + `pgcrypto` + `increment_times_seen()`.
- Config: `drizzle.config.ts` (auto-loads `.env.local`, so no extra flags needed).

```bash
npm run db:generate  # after editing db/schema.ts — creates a new migration
npm run db:migrate   # apply pending migrations (drizzle-kit migrate)
npm run db:push      # dev shortcut: sync schema directly, no migration file
npm run db:studio    # visual DB browser
```

Seamless workflow for contributors: edit `db/schema.ts` → `db:generate` → commit the
migration → everyone runs `db:migrate`. No hand-written SQL needed.

Legacy: `db/schema.sql` + `npm run db:migrate:sql` (raw-SQL equivalent of the baseline,
kept as fallback). Old files `00_*.sql`, `01_*.sql`, `02_*.sql` are history only.
The `supabase_realtime` publication lines from `02_*` are Supabase-only and
intentionally not in Drizzle migrations (plain PG uses polling).

**Existing Supabase DBs:** your tables already exist, so do NOT run the baseline
migration blindly (it would fail on `CREATE TABLE`). Either keep running as-is
(the Drizzle runtime only queries tables — it doesn't care how they were created),
or baseline once: run the baseline migration's statements manually where missing,
then mark it applied by inserting its hash into `drizzle.__drizzle_migrations` —
or simplest, `npm run db:push` (introspects and only applies diffs).

## 5. How the abstraction works

- `lib/db/provider.ts` — `getServerProvider()`: `DATABASE_URL` → `'pg'`, else `'supabase'`.
- `lib/db/pg.ts` — `pg` Pool singleton (shared by Drizzle).
- `lib/db/drizzle.ts` — Drizzle client singleton (`drizzle-orm/node-postgres` + `db/schema.ts`).
- `lib/db/store.ts` — every DB call (`dbUpsertLeads`, `dbSearchMain`, …) has a
  `pg` branch (Drizzle query builder) and a Supabase branch. Runtime rows are
  normalized to snake_case, so API routes (`/api/search`, `/api/enrich`,
  `/api/leads/search`) behave identically on both providers.
- `lib/data-client.ts` — frontend: Supabase JS when `NEXT_PUBLIC_SUPABASE_*` exists,
  else `/api/db/*` REST. New routes: `leads`, `today`, `testing`, `sessions`,
  `session-leads`, `lead` (GET+PATCH), plus `/api/health`.
- `lib/supabase.ts` no longer throws without envs (warns, PG-only mode works).

## 6. Verify

```bash
curl localhost:3000/api/health
# pg mode:      {"ok":true,"provider":"pg","pg":true,"supabase":false,"realtime":false}
# supabase:     {"ok":true,"provider":"supabase","pg":false,"supabase":true,"realtime":true}
```
