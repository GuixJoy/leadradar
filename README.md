# LeadRadar

<p align="center">
  <img src="public/logo.png" alt="LeadRadar" width="360" />
</p>

<p align="center">
  <strong>Discover local businesses. Enrich their public data. Build your pipeline.</strong>
  <br />
  An open-source Google Maps lead intelligence platform — Next.js, Postgres, and Drizzle ORM.
</p>

<p align="center">
  <a href="https://github.com/GuixJoy/leadradar"><img src="https://img.shields.io/github/stars/GuixJoy/leadradar?style=social" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/version-0.0.1-indigo" alt="Version 0.0.1" />
  <img src="https://img.shields.io/badge/license-LGPL--2.1-blue" alt="License: LGPL-2.1" />
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/Postgres-Drizzle_ORM-336791" alt="Postgres + Drizzle" />
</p>

<p align="center">
  ⭐ <strong>If LeadRadar helps you, please star the repo</strong> — it keeps the project alive and growing.
</p>

<p align="center">
  <img src="public/dashboard.png" alt="LeadRadar dashboard — area scan with live results panel" width="800" />
  <br />
  <em>Live Scan view: search area, category filters, and the results panel.</em>
</p>

---

## ✨ Features

- **📍 Location-based discovery** — scan any area with a configurable radius
- **🏷️ Category expansion** — related categories and search terms widen coverage
- **🔀 Multi-strategy search** — Google Places Nearby Search + Text Search combined
- **🗺️ Grid scanning with adaptive subdivision** — dense cells split automatically for finer results
- **🛡️ Duplicate-safe** — deduplication across scans, repeat sightings tracked per lead
- **🟢 Business status** — operational / temporarily closed signals from the API
- **📞 Enrichment** — phone, website, rating, and review counts per business
- **🎥 360 checks** — Street View / 360 availability indicators
- **🗂️ Historical database** — LIVE, TODAY, MAIN, and TESTING views backed by Postgres
- **⚡ Realtime (Supabase) or polling (plain PG)** — works with or without Supabase
- **📤 CSV export** — one-click export of any view
- **🔧 Developer-friendly** — modular TypeScript codebase, API routes, Drizzle migrations

> Results depend on Google's API availability, ranking, limits, and returned metadata.
> LeadRadar only collects publicly available business information.

## 🚀 Quickstart

**Prerequisites:** Node.js 18+, a Google Cloud API key (Places API New + Maps JavaScript + Street View).

```bash
# 1. Clone
git clone https://github.com/GuixJoy/leadradar.git
cd leadradar

# 2. Database (Docker Postgres)
docker compose up -d

# 3. Configure
cp .env.example .env.local
# → set DATABASE_URL, GOOGLE_PLACES_API_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# 4. Install + migrate + run
npm install
npm run db:migrate
npm run dev
```

Open **http://localhost:3000** → pick an area, category, and radius → **Scan Area**.

### Using managed Postgres or Supabase

```env
# Any Postgres (Neon, RDS, Supabase pooler) — no Supabase JS keys needed
DATABASE_URL=postgresql://user:pass@host:5432/leadradar?sslmode=require
```

```env
# ...or Supabase mode (enables realtime instead of polling)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

See **[DB_SETUP.md](DB_SETUP.md)** for the full database guide.

## ⚙️ Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ (or Supabase pair) | Plain Postgres connection (Docker, Neon, RDS, Supabase pooler) |
| `GOOGLE_PLACES_API_KEY` | ✅ | Server-side Places + Street View Metadata API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ | Client-side map rendering |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase mode | Supabase REST + realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase mode | Supabase client key |

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:generate` | Generate a Drizzle migration from `db/schema.ts` |
| `npm run db:migrate` | Apply pending Drizzle migrations |
| `npm run db:migrate:sql` | Legacy raw-SQL baseline migration |
| `npm run db:migrate:sql` | Legacy raw-SQL baseline migration (`db/migrations/schema.sql`) |
| `npm run db:push` | Dev shortcut: sync schema directly |
| `npm run db:studio` | Visual database browser |
| `npm run lint` | Lint the project |

## 🗄️ How queries run

**Provider selection** (`lib/db/provider.ts`): if `DATABASE_URL` is set, the server talks to plain
Postgres via Drizzle ORM; otherwise it falls back to Supabase REST. The frontend mirrors this —
Supabase JS with realtime when configured, else the `/api/db/*` REST routes with polling.

**All queries live in `lib/db/store.ts`.** Every function (upserts, search, lists, sessions,
`times_seen` tracking) has a `pg` branch and a Supabase branch, and always returns plain
**snake_case** rows — so API routes behave identically on both providers. Schema source of truth
is `db/schema.ts` (4 tables: `leads`, `scrape_sessions`, `lead_scrape_map`, `testing`).

**Write paths:**

| Action | Route → query |
|---|---|
| Discovery scan | `/api/search` → `dbUpsertLeads` (batched, `ON CONFLICT(id) DO UPDATE`, `times_seen` incremented) |
| Enrichment | `/api/enrich` → `dbUpdateLead` (phone, website, rating, `business_status`, `country`, `enrichment_completed`) |
| 360 / field edits | `PATCH /api/db/lead` → `dbUpdateLead` (allowlisted columns only) |
| Sessions | `/api/search` → `dbCreateScrapeSession` + `dbUpsertScrapeMap` + `dbUpdateSessionTotal` |

**Schema changes:** edit `db/schema.ts` → `npm run db:generate` → commit the migration →
`npm run db:migrate`. Verify with `curl localhost:3000/api/health`
(`{"provider":"pg",...}` or `{"provider":"supabase",...}`). Full guide: **[DB_SETUP.md](DB_SETUP.md)**.

## 🧱 Tech stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 · **UI:** Radix/shadcn · **Icons:** Lucide
- **Database:** PostgreSQL (self-hosted, Neon/RDS, or Supabase) via **Drizzle ORM** + `pg`
- **Maps data:** Google Places API New (Nearby, Text, Details, Autocomplete) + Street View Metadata API
- **Realtime:** Supabase channels (Supabase mode) / polling (plain PG mode)

## 📁 Project structure

```
app/
  page.tsx               # Dashboard (LIVE / TODAY / MAIN / TESTING views)
  api/
    search/              # Discovery engine (cache → Google grid search → upsert)
    enrich/              # Place Details enrichment + USA/testing detection
    streetview/          # 360 availability checks
    leads/search/        # Text search across scopes
    db/*/health          # PG-mode REST + provider health
lib/
  db/                    # provider.ts · pg.ts · drizzle.ts · store.ts (dual PG/Supabase)
  discovery/             # grid + geo math
  data-client.ts         # Frontend data layer (Supabase JS or REST fallback)
db/
  schema.ts              # Drizzle source of truth
  migrations/            # Generated migrations (baseline: 0000_*)
components/              # Map, lead table/cards, radar loader, ui/*
```

## 🗺️ Roadmap

- [ ] Saved searches & favorites
- [ ] Bulk enrichment queues
- [ ] Advanced analytics dashboard
- [ ] Export to PDF / webhooks
- [ ] AI-powered lead scoring & recommendations

Have an idea? [Open an issue](https://github.com/GuixJoy/leadradar/issues) or a PR — contributions are welcome.

## 🤝 Contributing

1. Fork the repo and create a feature branch
2. `npm run db:generate` after any `db/schema.ts` change and commit the migration
3. Ensure `npm run build` passes
4. Open a pull request describing the change

## ☕ Support the project

LeadRadar is built and maintained by **[GuixJoy](https://github.com/GuixJoy)** in his own time.
If it saves you hours of manual prospecting, consider buying him a coffee:

<p>
  <a href="https://www.buymeacoffee.com/GuixJoy" target="_blank">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
  </a>
  <a href="https://github.com/GuixJoy" target="_blank">
    <img src="https://img.shields.io/badge/GitHub-GuixJoy-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub: GuixJoy" />
  </a>
  <a href="https://www.linkedin.com/in/joy-athawale/" target="_blank">
    <img src="https://img.shields.io/badge/LinkedIn-Joy_Athawale-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn: Joy Athawale" />
  </a>
</p>

And don't forget to ⭐ **star the repo** — it's the easiest way to support open source.

## 📄 License

LeadRadar © 2026 [GuixJoy](https://github.com/GuixJoy).
Licensed under the **GNU Lesser General Public License v2.1** — see [LICENSE](LICENSE) for details.

## 🏷️ Topics

`lead-generation` · `google-maps` · `business-intelligence` · `sales-prospecting` · `nextjs` · `typescript` · `postgresql` · `drizzle-orm` · `supabase` · `open-source` · `leadradar`
