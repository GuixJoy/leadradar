// Drizzle schema — single source of truth for LeadRadar tables.
// Mirrors db/schema.sql exactly (table/column names are snake_case to match
// the existing Supabase DBs). Run `npm run db:generate` after editing,
// then `npm run db:migrate` to apply.
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

const tzNow = () => sql`now()`;

export const leads = pgTable(
  'leads',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    address: text('address'),
    phone: text('phone'),
    website: text('website'),
    has360: boolean('has_360').default(false),
    hasPhone: boolean('has_phone').default(false),
    hasWebsite: boolean('has_website').default(false),
    category: text('category'),
    rating: doublePrecision('rating'),
    reviewsCount: integer('reviews_count').default(0),
    score: integer('score').default(0),
    status: text('status').default('DISCOVERED'),
    streetViewStatus: text('street_view_status'),
    businessStatus: text('business_status').default('UNKNOWN'),
    enrichmentCompleted: boolean('enrichment_completed').default(false),
    lastEnrichedAt: timestamp('last_enriched_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).default(tzNow()),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).default(tzNow()),
    timesSeen: integer('times_seen').default(1),
    country: text('country'),
    createdAt: timestamp('created_at', { withTimezone: true }).default(tzNow()),
  },
  (t) => [
    index('idx_leads_category').on(t.category),
    index('idx_leads_created_at').on(t.createdAt),
    index('idx_leads_business_status').on(t.businessStatus),
  ]
);

export const scrapeSessions = pgTable('scrape_sessions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(tzNow()),
  location: text('location'),
  category: text('category'),
  radius: integer('radius'),
  totalResults: integer('total_results').default(0),
  notes: text('notes'),
});

export const leadScrapeMap = pgTable(
  'lead_scrape_map',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    leadId: text('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => scrapeSessions.id, { onDelete: 'cascade' }),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).default(tzNow()),
  },
  (t) => [
    unique('lead_scrape_map_lead_id_session_id_unique').on(t.leadId, t.sessionId),
    index('idx_lead_scrape_map_scraped_at').on(t.scrapedAt),
    index('idx_lead_scrape_map_session_id').on(t.sessionId),
    index('idx_lead_scrape_map_lead_id').on(t.leadId),
  ]
);

export const testing = pgTable('testing', {
  id: text('id').primaryKey(),
  name: text('name'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  address: text('address'),
  phone: text('phone'),
  website: text('website'),
  category: text('category'),
  rating: doublePrecision('rating'),
  reviewsCount: integer('reviews_count').default(0),
  country: text('country').default('USA'),
  streetViewStatus: text('street_view_status').default('NOT_CHECKED'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(tzNow()),
});

export const leadsRelations = relations(leads, ({ many }) => ({
  scrapeMaps: many(leadScrapeMap),
}));

export const scrapeSessionsRelations = relations(scrapeSessions, ({ many }) => ({
  scrapeMaps: many(leadScrapeMap),
}));

export const leadScrapeMapRelations = relations(leadScrapeMap, ({ one }) => ({
  lead: one(leads, { fields: [leadScrapeMap.leadId], references: [leads.id] }),
  session: one(scrapeSessions, {
    fields: [leadScrapeMap.sessionId],
    references: [scrapeSessions.id],
  }),
}));

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type ScrapeSession = typeof scrapeSessions.$inferSelect;
export type LeadScrapeMapRow = typeof leadScrapeMap.$inferSelect;
export type TestingLead = typeof testing.$inferSelect;
