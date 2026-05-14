-- Migration: Add enrichment_completed column and fallback missing business_status to UNKNOWN
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS enrichment_completed boolean DEFAULT false;

UPDATE leads
SET business_status = 'UNKNOWN'
WHERE business_status IS NULL;

UPDATE leads
SET enrichment_completed = true
WHERE last_enriched_at IS NOT NULL;
