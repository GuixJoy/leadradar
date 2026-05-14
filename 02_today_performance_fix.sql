-- Migration: Performance + Realtime fixes for LIVE/TODAY architecture

-- 1. Index on scraped_at for efficient TODAY section queries
CREATE INDEX IF NOT EXISTS idx_lead_scrape_map_scraped_at 
  ON lead_scrape_map(scraped_at DESC);

-- 2. Index on session_id for session filtering
CREATE INDEX IF NOT EXISTS idx_lead_scrape_map_session_id 
  ON lead_scrape_map(session_id);

-- 3. Index on lead_id for lead lookups
CREATE INDEX IF NOT EXISTS idx_lead_scrape_map_lead_id 
  ON lead_scrape_map(lead_id);

-- 4. Ensure lead_scrape_map is in Supabase realtime publication
-- (Run this if lead_scrape_map INSERTs are not triggering realtime events)
ALTER PUBLICATION supabase_realtime ADD TABLE lead_scrape_map;

-- 5. Ensure leads is in Supabase realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- 6. Ensure scrape_sessions is in Supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE scrape_sessions;

-- NOTE: If the ALTER PUBLICATION commands fail with "already exists",
-- that is expected and safe to ignore.
