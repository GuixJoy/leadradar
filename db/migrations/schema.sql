-- LeadRadar unified Postgres schema.
-- Works on vanilla Postgres (Docker / Neon / RDS) AND Supabase (which is Postgres).
-- Run: psql $DATABASE_URL -f db/migrations/schema.sql   OR   npm run db:migrate:sql
-- Idempotent: safe to re-run.

-- Needed for gen_random_uuid() on vanilla PG
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ leads (master table) ============
CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  name text,
  lat double precision,
  lng double precision,
  address text,
  phone text,
  website text,
  has_360 boolean DEFAULT false,
  has_phone boolean DEFAULT false,
  has_website boolean DEFAULT false,
  category text,
  rating double precision,
  reviews_count integer DEFAULT 0,
  score integer DEFAULT 0,
  status text DEFAULT 'DISCOVERED',
  street_view_status text,
  business_status text DEFAULT 'UNKNOWN',
  enrichment_completed boolean DEFAULT false,
  last_enriched_at timestamptz,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  times_seen integer DEFAULT 1,
  country text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_business_status ON leads(business_status);

-- ============ scrape_sessions ============
CREATE TABLE IF NOT EXISTS scrape_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  location text,
  category text,
  radius integer,
  total_results integer DEFAULT 0,
  notes text
);

-- ============ lead_scrape_map ============
CREATE TABLE IF NOT EXISTS lead_scrape_map (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id text REFERENCES leads(id) ON DELETE CASCADE,
  session_id uuid REFERENCES scrape_sessions(id) ON DELETE CASCADE,
  scraped_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_scrape_map_scraped_at ON lead_scrape_map(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scrape_map_session_id ON lead_scrape_map(session_id);
CREATE INDEX IF NOT EXISTS idx_lead_scrape_map_lead_id ON lead_scrape_map(lead_id);

-- ============ testing (USA leads) ============
CREATE TABLE IF NOT EXISTS testing (
  id text PRIMARY KEY,
  name text,
  lat double precision,
  lng double precision,
  address text,
  phone text,
  website text,
  category text,
  rating double precision,
  reviews_count integer DEFAULT 0,
  country text DEFAULT 'USA',
  street_view_status text DEFAULT 'NOT_CHECKED',
  created_at timestamptz DEFAULT now()
);

-- ============ atomic increment helper ============
CREATE OR REPLACE FUNCTION increment_times_seen(target_lead_id text)
RETURNS void AS $$
BEGIN
  UPDATE leads
  SET times_seen = COALESCE(times_seen, 1) + 1,
      last_seen_at = now()
  WHERE id = target_lead_id;
END;
$$ LANGUAGE plpgsql;

-- ============ backfills (safe on fresh DB) ============
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS times_seen integer DEFAULT 1;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrichment_completed boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS street_view_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_360 boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_status text DEFAULT 'UNKNOWN';

UPDATE leads SET business_status = 'UNKNOWN' WHERE business_status IS NULL;
UPDATE leads SET enrichment_completed = true WHERE last_enriched_at IS NOT NULL AND enrichment_completed IS DISTINCT FROM true;
