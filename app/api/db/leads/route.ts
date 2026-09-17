import { NextResponse } from 'next/server';
import { dbListMain } from '@/lib/db/store';

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
  times_seen: row.times_seen || 1,
});

// GET /api/db/leads?page=1&pageSize=50 — PG + Supabase compatible
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const { rows, total } = await dbListMain(page, pageSize);
    return NextResponse.json({ leads: rows.map(mapRow), total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}
