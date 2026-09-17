import { NextResponse } from 'next/server';
import { dbTodayLeads } from '@/lib/db/store';

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

export async function GET() {
  try {
    const rows = await dbTodayLeads();
    return NextResponse.json({ leads: rows.map(mapRow), count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}
