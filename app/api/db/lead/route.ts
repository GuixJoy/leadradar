import { NextResponse } from 'next/server';
import { dbGetLeadById, dbUpdateLead } from '@/lib/db/store';

const mapRow = (row: any) => ({
  id: row.id,
  name: row.name || 'Unknown',
  lat: row.lat,
  lng: row.lng,
  address: row.address,
  phone: row.phone,
  website: row.website,
  has_360: row.has_360,
  streetViewStatus: row.street_view_status || undefined,
  category: row.category,
  rating: row.rating,
  reviews_count: row.reviews_count,
  score: row.score,
  status: row.status || 'DISCOVERED',
  last_enriched_at: row.last_enriched_at,
  has_website: row.has_website,
  business_status: row.business_status,
  enrichment_completed: row.enrichment_completed,
  country: row.country,
  times_seen: row.times_seen || 1,
});

// GET /api/db/lead?id=... — single lead (PG + Supabase)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
    const row = await dbGetLeadById(id);
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ lead: mapRow(row) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}

// PATCH /api/db/lead { id, fields } — e.g. 360 updates from client without supabase-js
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || '');
    const fields = body.fields || {};
    if (!id || typeof fields !== 'object') {
      return NextResponse.json({ error: 'missing id/fields' }, { status: 400 });
    }
    // Allowlist to avoid arbitrary column writes
    const allowed = new Set(['street_view_status', 'has_360', 'phone', 'website', 'rating', 'reviews_count', 'business_status', 'enrichment_completed', 'last_enriched_at', 'status', 'country']);
    const safe: Record<string, any> = {};
    for (const k of Object.keys(fields)) {
      if (allowed.has(k)) safe[k] = fields[k];
    }
    if (Object.keys(safe).length === 0) {
      return NextResponse.json({ error: 'no allowed fields' }, { status: 400 });
    }
    await dbUpdateLead(id, safe);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'update failed' }, { status: 500 });
  }
}
