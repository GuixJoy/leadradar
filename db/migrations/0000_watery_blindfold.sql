CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE "lead_scrape_map" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lead_scrape_map_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lead_id" text,
	"session_id" uuid,
	"scraped_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "lead_scrape_map_lead_id_session_id_unique" UNIQUE("lead_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"lat" double precision,
	"lng" double precision,
	"address" text,
	"phone" text,
	"website" text,
	"has_360" boolean DEFAULT false,
	"has_phone" boolean DEFAULT false,
	"has_website" boolean DEFAULT false,
	"category" text,
	"rating" double precision,
	"reviews_count" integer DEFAULT 0,
	"score" integer DEFAULT 0,
	"status" text DEFAULT 'DISCOVERED',
	"street_view_status" text,
	"business_status" text DEFAULT 'UNKNOWN',
	"enrichment_completed" boolean DEFAULT false,
	"last_enriched_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"times_seen" integer DEFAULT 1,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scrape_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"location" text,
	"category" text,
	"radius" integer,
	"total_results" integer DEFAULT 0,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "testing" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"lat" double precision,
	"lng" double precision,
	"address" text,
	"phone" text,
	"website" text,
	"category" text,
	"rating" double precision,
	"reviews_count" integer DEFAULT 0,
	"country" text DEFAULT 'USA',
	"street_view_status" text DEFAULT 'NOT_CHECKED',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lead_scrape_map" ADD CONSTRAINT "lead_scrape_map_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scrape_map" ADD CONSTRAINT "lead_scrape_map_session_id_scrape_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scrape_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lead_scrape_map_scraped_at" ON "lead_scrape_map" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "idx_lead_scrape_map_session_id" ON "lead_scrape_map" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_lead_scrape_map_lead_id" ON "lead_scrape_map" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_leads_category" ON "leads" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_leads_created_at" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_business_status" ON "leads" USING btree ("business_status");--> statement-breakpoint
CREATE OR REPLACE FUNCTION increment_times_seen(target_lead_id text)
RETURNS void AS $$
BEGIN
  UPDATE leads
  SET times_seen = COALESCE(times_seen, 1) + 1,
      last_seen_at = now()
  WHERE id = target_lead_id;
END;
$$ LANGUAGE plpgsql;