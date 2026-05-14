-- 1. Create Scrape Sessions Table
CREATE TABLE IF NOT EXISTS scrape_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  location text,
  category text,
  radius integer,
  total_results integer default 0,
  notes text
);

-- 2. Create Lead Scrape Map Table
CREATE TABLE IF NOT EXISTS lead_scrape_map (
  id bigint generated always as identity primary key,
  lead_id text references leads(id) on delete cascade,
  session_id uuid references scrape_sessions(id) on delete cascade,
  scraped_at timestamptz default now(),
  UNIQUE(lead_id, session_id)
);

-- 3. Add Tracking Columns to Leads Table
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz default now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz default now(),
  ADD COLUMN IF NOT EXISTS times_seen integer default 1;

-- 4. Create RPC for atomic increment
CREATE OR REPLACE FUNCTION increment_times_seen(target_lead_id text)
RETURNS void AS $$
BEGIN
  UPDATE leads
  SET times_seen = coalesce(times_seen, 1) + 1,
      last_seen_at = now()
  WHERE id = target_lead_id;
END;
$$ LANGUAGE plpgsql;
