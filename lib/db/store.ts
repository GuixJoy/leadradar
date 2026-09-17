import { and, count, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { supabase } from '@/lib/supabase';
import { leadScrapeMap, leads, scrapeSessions, testing } from '@/db/schema';
import { getDb } from './drizzle';
import { getServerProvider } from './provider';

// All functions return plain DB rows (snake_case) and work on BOTH
// plain Postgres (DATABASE_URL, via Drizzle) and Supabase (via supabase-js).
// Supabase IS Postgres, so the same schema (db/schema.ts) works everywhere.

export type LeadRow = Record<string, any>;

// ---------- drizzle <-> snake_case mappers ----------
// Runtime rows stay snake_case so every caller (API routes, /api/db/*)
// behaves identically regardless of provider.

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v);
const asDate = (v: any) => {
  if (v === null || v === undefined) return v ?? null;
  return v instanceof Date ? v : new Date(v);
};

function fromLead(r: any): LeadRow {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    phone: r.phone,
    website: r.website,
    has_360: r.has360,
    has_phone: r.hasPhone,
    has_website: r.hasWebsite,
    category: r.category,
    rating: r.rating,
    reviews_count: r.reviewsCount,
    score: r.score,
    status: r.status,
    street_view_status: r.streetViewStatus,
    business_status: r.businessStatus,
    enrichment_completed: r.enrichmentCompleted,
    last_enriched_at: iso(r.lastEnrichedAt),
    first_seen_at: iso(r.firstSeenAt),
    last_seen_at: iso(r.lastSeenAt),
    times_seen: r.timesSeen,
    country: r.country,
    created_at: iso(r.createdAt),
  };
}

function toLeadInsert(l: LeadRow) {
  return {
    id: l.id,
    name: l.name ?? null,
    lat: l.lat ?? null,
    lng: l.lng ?? null,
    address: l.address ?? null,
    phone: l.phone ?? null,
    website: l.website ?? null,
    has360: l.has_360 ?? false,
    hasPhone: l.has_phone ?? null,
    hasWebsite: l.has_website ?? null,
    category: l.category ?? null,
    rating: l.rating ?? null,
    reviewsCount: l.reviews_count ?? 0,
    score: l.score ?? 0,
    status: l.status ?? 'DISCOVERED',
    lastEnrichedAt: asDate(l.last_enriched_at),
    firstSeenAt: asDate(l.first_seen_at),
    lastSeenAt: asDate(l.last_seen_at),
    timesSeen: l.times_seen ?? 1,
  };
}

// `ON CONFLICT (id) DO UPDATE SET col = excluded.col` for every updatable col.
// Callers pre-merge times_seen/first_seen_at in JS, so plain overwrite is correct.
const LEAD_UPSERT_SET = {
  name: sql`excluded."name"`,
  lat: sql`excluded."lat"`,
  lng: sql`excluded."lng"`,
  address: sql`excluded."address"`,
  phone: sql`excluded."phone"`,
  website: sql`excluded."website"`,
  has360: sql`excluded."has_360"`,
  hasPhone: sql`excluded."has_phone"`,
  hasWebsite: sql`excluded."has_website"`,
  category: sql`excluded."category"`,
  rating: sql`excluded."rating"`,
  reviewsCount: sql`excluded."reviews_count"`,
  score: sql`excluded."score"`,
  status: sql`excluded."status"`,
  lastEnrichedAt: sql`excluded."last_enriched_at"`,
  lastSeenAt: sql`excluded."last_seen_at"`,
  timesSeen: sql`excluded."times_seen"`,
  firstSeenAt: sql`COALESCE("leads"."first_seen_at", excluded."first_seen_at")`,
} as const;

function fromTesting(r: any): LeadRow {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    phone: r.phone,
    website: r.website,
    category: r.category,
    rating: r.rating,
    reviews_count: r.reviewsCount,
    country: r.country,
    street_view_status: r.streetViewStatus,
    created_at: iso(r.createdAt),
  };
}

function toTestingInsert(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    address: row.address ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    category: row.category ?? null,
    rating: row.rating ?? null,
    reviewsCount: row.reviews_count ?? 0,
    country: row.country ?? 'USA',
    streetViewStatus: row.street_view_status ?? 'NOT_CHECKED',
  };
}

function fromSession(r: any): LeadRow {
  return {
    id: r.id,
    created_at: iso(r.createdAt),
    location: r.location,
    category: r.category,
    radius: r.radius,
    total_results: r.totalResults,
    notes: r.notes,
  };
}

// snake_case client fields -> drizzle camelCase (allowlisted, mirrors /api/db/lead)
const LEAD_FIELD_MAP: Record<string, string> = {
  street_view_status: 'streetViewStatus',
  has_360: 'has360',
  phone: 'phone',
  website: 'website',
  rating: 'rating',
  reviews_count: 'reviewsCount',
  business_status: 'businessStatus',
  enrichment_completed: 'enrichmentCompleted',
  last_enriched_at: 'lastEnrichedAt',
  status: 'status',
};

export async function dbGetLeadsByCategory(category: string): Promise<LeadRow[]> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb().select().from(leads).where(eq(leads.category, category));
    return rows.map(fromLead);
  }
  const { data } = await supabase.from('leads').select('*').eq('category', category);
  return data || [];
}

export async function dbGetLeadsByIds(ids: string[], columns = '*'): Promise<LeadRow[]> {
  void columns; // projection unused: rows are small, callers need full objects
  if (ids.length === 0) return [];
  if (getServerProvider() === 'pg') {
    const out: LeadRow[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await getDb().select().from(leads).where(inArray(leads.id, ids.slice(i, i + 500)));
      out.push(...rows.map(fromLead));
    }
    return out;
  }
  const { data } = await supabase.from('leads').select('*').in('id', ids);
  return data || [];
}

export async function dbGetLeadById(id: string): Promise<LeadRow | null> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb().select().from(leads).where(eq(leads.id, id)).limit(1);
    return rows[0] ? fromLead(rows[0]) : null;
  }
  const { data } = await supabase.from('leads').select('*').eq('id', id).single();
  return data || null;
}

export async function dbUpsertLeads(leadsRows: LeadRow[]): Promise<LeadRow[]> {
  if (leadsRows.length === 0) return [];
  if (getServerProvider() === 'pg') {
    const db = getDb();
    const out: LeadRow[] = [];
    for (let i = 0; i < leadsRows.length; i += 50) {
      const rows = await db
        .insert(leads)
        .values(leadsRows.slice(i, i + 50).map(toLeadInsert))
        .onConflictDoUpdate({ target: leads.id, set: { ...LEAD_UPSERT_SET } })
        .returning();
      out.push(...rows.map(fromLead));
    }
    return out;
  }
  const { data, error } = await supabase.from('leads').upsert(leadsRows, { onConflict: 'id' }).select();
  if (error) throw error;
  return data || [];
}

export async function dbGetExistingMeta(ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (ids.length === 0) return map;
  if (getServerProvider() === 'pg') {
    const db = getDb();
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await db
        .select({ id: leads.id, timesSeen: leads.timesSeen, firstSeenAt: leads.firstSeenAt })
        .from(leads)
        .where(inArray(leads.id, ids.slice(i, i + 500)));
      rows.forEach((r) =>
        map.set(r.id, { id: r.id, times_seen: r.timesSeen, first_seen_at: iso(r.firstSeenAt) })
      );
    }
    return map;
  }
  const { data } = await supabase.from('leads').select('id, times_seen, first_seen_at').in('id', ids);
  (data || []).forEach((r: any) => map.set(r.id, r));
  return map;
}

export async function dbUpsertScrapeMap(rows: { lead_id: string; session_id: string }[]): Promise<void> {
  if (rows.length === 0) return;
  if (getServerProvider() === 'pg') {
    const db = getDb();
    for (let i = 0; i < rows.length; i += 500) {
      await db
        .insert(leadScrapeMap)
        .values(rows.slice(i, i + 500).map((r) => ({ leadId: r.lead_id, sessionId: r.session_id })))
        .onConflictDoNothing({ target: [leadScrapeMap.leadId, leadScrapeMap.sessionId] });
    }
    return;
  }
  await supabase.from('lead_scrape_map').upsert(rows, { onConflict: 'lead_id,session_id', ignoreDuplicates: true });
}

export async function dbCountSessionLeads(sessionId: string): Promise<number> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb()
      .select({ c: count() })
      .from(leadScrapeMap)
      .where(eq(leadScrapeMap.sessionId, sessionId));
    return rows[0]?.c ?? 0;
  }
  const { count: c } = await supabase.from('lead_scrape_map').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
  return c ?? 0;
}

export async function dbUpdateSessionTotal(sessionId: string, total: number): Promise<void> {
  if (getServerProvider() === 'pg') {
    await getDb().update(scrapeSessions).set({ totalResults: total }).where(eq(scrapeSessions.id, sessionId));
    return;
  }
  await supabase.from('scrape_sessions').update({ total_results: total }).eq('id', sessionId);
}

export async function dbCreateScrapeSession(input: { location: string; category: string; radius: number }): Promise<{ id: string } | null> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb().insert(scrapeSessions).values(input).returning({ id: scrapeSessions.id });
    return rows[0] || null;
  }
  const { data } = await supabase.from('scrape_sessions').insert(input).select('id').single();
  return data || null;
}

export async function dbIncrementTimesSeen(leadId: string, fallbackTimesSeen: number): Promise<void> {
  if (getServerProvider() === 'pg') {
    await getDb()
      .update(leads)
      .set({
        timesSeen: sql`COALESCE(${leads.timesSeen}, 1) + 1`,
        lastSeenAt: new Date(),
      })
      .where(eq(leads.id, leadId));
    return;
  }
  const { error } = await supabase.rpc('increment_times_seen', { target_lead_id: leadId });
  if (error) {
    await supabase.from('leads').update({
      last_seen_at: new Date().toISOString(),
      times_seen: (fallbackTimesSeen || 1) + 1,
    }).eq('id', leadId);
  }
}

export async function dbUpdateLead(id: string, fields: Record<string, any>): Promise<void> {
  if (getServerProvider() === 'pg') {
    const set: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      const mapped = LEAD_FIELD_MAP[k];
      if (!mapped) continue;
      set[mapped] = k === 'last_enriched_at' ? asDate(v) : v;
    }
    if (Object.keys(set).length === 0) return;
    await getDb().update(leads).set(set).where(eq(leads.id, id));
    return;
  }
  const { error } = await supabase.from('leads').update(fields).eq('id', id);
  if (error) throw error;
}

export async function dbUpsertTesting(row: Record<string, any>): Promise<void> {
  if (getServerProvider() === 'pg') {
    const value = toTestingInsert(row);
    await getDb()
      .insert(testing)
      .values(value)
      .onConflictDoUpdate({
        target: testing.id,
        set: {
          name: sql`excluded."name"`,
          lat: sql`excluded."lat"`,
          lng: sql`excluded."lng"`,
          address: sql`excluded."address"`,
          phone: sql`excluded."phone"`,
          website: sql`excluded."website"`,
          category: sql`excluded."category"`,
          rating: sql`excluded."rating"`,
          reviewsCount: sql`excluded."reviews_count"`,
          country: sql`excluded."country"`,
          streetViewStatus: sql`excluded."street_view_status"`,
        },
      });
    return;
  }
  const { error } = await supabase.from('testing').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

// ---- list/search helpers (used by /api/db/* + search route) ----

export async function dbSearchMain(query: string, limit = 200): Promise<LeadRow[]> {
  const like = `%${query.replace(/%/g, '\\%')}%`;
  if (getServerProvider() === 'pg') {
    const rows = await getDb()
      .select()
      .from(leads)
      .where(
        or(
          ilike(leads.name, like),
          ilike(leads.address, like),
          ilike(leads.phone, like),
          ilike(leads.website, like),
          ilike(leads.category, like)
        )
      )
      .orderBy(desc(leads.createdAt))
      .limit(limit);
    return rows.map(fromLead);
  }
  const filter = ['name', 'address', 'phone', 'website', 'category'].map((c) => `${c}.ilike.${like}`).join(',');
  const { data } = await supabase.from('leads').select('*').or(filter).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function dbSearchTesting(query: string, limit = 200): Promise<LeadRow[]> {
  const like = `%${query.replace(/%/g, '\\%')}%`;
  if (getServerProvider() === 'pg') {
    const rows = await getDb()
      .select()
      .from(testing)
      .where(
        or(
          ilike(testing.name, like),
          ilike(testing.address, like),
          ilike(testing.phone, like),
          ilike(testing.website, like),
          ilike(testing.category, like)
        )
      )
      .orderBy(desc(testing.createdAt))
      .limit(limit);
    return rows.map(fromTesting);
  }
  const filter = ['name', 'address', 'phone', 'website', 'category'].map((c) => `${c}.ilike.${like}`).join(',');
  const { data } = await supabase.from('testing').select('*').or(filter).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function dbSearchLiveToday(query: string, scope: 'live' | 'today', sessionId: string | null, limit = 200): Promise<LeadRow[]> {
  const like = `%${query.replace(/%/g, '\\%')}%`;
  if (getServerProvider() === 'pg') {
    const conditions = [
      or(
        ilike(leads.name, like),
        ilike(leads.address, like),
        ilike(leads.phone, like),
        ilike(leads.website, like),
        ilike(leads.category, like)
      ),
    ];
    if (scope === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      conditions.push(gte(leadScrapeMap.scrapedAt, today));
    }
    if (sessionId) conditions.push(eq(leadScrapeMap.sessionId, sessionId));
    const rows = await getDb()
      .select()
      .from(leadScrapeMap)
      .innerJoin(leads, eq(leadScrapeMap.leadId, leads.id))
      .where(and(...conditions))
      .orderBy(desc(leadScrapeMap.scrapedAt))
      .limit(limit);
    return rows.map((r) => fromLead(r.leads));
  }
  // Supabase path: join query with foreign-table filter
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filter = ['name', 'address', 'phone', 'website', 'category'].map((c) => `${c}.ilike.${like}`).join(',');
  let qb = supabase.from('lead_scrape_map').select('lead_id, scraped_at, leads(*)').order('scraped_at', { ascending: false }).limit(limit);
  if (scope === 'today') qb = qb.gte('scraped_at', today.toISOString());
  if (sessionId) qb = qb.eq('session_id', sessionId);
  qb = qb.or(filter, { foreignTable: 'leads' });
  const { data } = await qb;
  return (data || []).map((r: any) => r.leads).filter(Boolean);
}

export async function dbListMain(page = 1, pageSize = 50): Promise<{ rows: LeadRow[]; total: number }> {
  const offset = (page - 1) * pageSize;
  if (getServerProvider() === 'pg') {
    const db = getDb();
    const [rows, totalRows] = await Promise.all([
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(pageSize).offset(offset),
      db.select({ c: count() }).from(leads),
    ]);
    return { rows: rows.map(fromLead), total: totalRows[0]?.c ?? 0 };
  }
  const { data, count: c } = await supabase.from('leads').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
  return { rows: data || [], total: c ?? 0 };
}

export async function dbListTesting(): Promise<LeadRow[]> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb().select().from(testing).orderBy(desc(testing.createdAt));
    return rows.map(fromTesting);
  }
  const { data } = await supabase.from('testing').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function dbListSessions(): Promise<LeadRow[]> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb().select().from(scrapeSessions).orderBy(desc(scrapeSessions.createdAt));
    return rows.map(fromSession);
  }
  const { data } = await supabase.from('scrape_sessions').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function dbSessionLeadIds(sessionId: string): Promise<string[]> {
  if (getServerProvider() === 'pg') {
    const rows = await getDb()
      .select({ leadId: leadScrapeMap.leadId })
      .from(leadScrapeMap)
      .where(eq(leadScrapeMap.sessionId, sessionId));
    return rows.map((r) => r.leadId as string);
  }
  const { data } = await supabase.from('lead_scrape_map').select('lead_id').eq('session_id', sessionId);
  return (data || []).map((r: any) => r.lead_id);
}

export async function dbTodayLeads(): Promise<LeadRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (getServerProvider() === 'pg') {
    const db = getDb();
    const mapRows = await db
      .selectDistinct({ leadId: leadScrapeMap.leadId })
      .from(leadScrapeMap)
      .where(gte(leadScrapeMap.scrapedAt, today));
    if (mapRows.length === 0) return [];
    const ids = mapRows.map((r) => r.leadId as string);
    const out: LeadRow[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await db.select().from(leads).where(inArray(leads.id, ids.slice(i, i + 500)));
      out.push(...rows.map(fromLead));
    }
    return out;
  }
  const { data: mapData } = await supabase.from('lead_scrape_map').select('lead_id').gte('scraped_at', today.toISOString());
  if (!mapData || mapData.length === 0) return [];
  const ids = [...new Set(mapData.map((r: any) => r.lead_id))];
  const { data } = await supabase.from('leads').select('*').in('id', ids);
  return data || [];
}
