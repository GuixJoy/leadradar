import { NextResponse } from 'next/server';
import { dbGetLeadsByIds, dbSessionLeadIds } from '@/lib/db/store';

// GET /api/db/session-leads?sessionId=... -> { leadIds }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ leadIds: [] });
    const leadIds = await dbSessionLeadIds(sessionId);
    return NextResponse.json({ leadIds, count: leadIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}

// GET /api/db/lead?id=... -> single mapped lead (used for realtime/polling fallback)
export async function POST(request: Request) {
  // POST { ids: string[] } -> mapped leads (batch fetch, avoids N+1)
  try {
    const body = await request.json();
    const ids: string[] = body.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ leads: [] });
    const rows = await dbGetLeadsByIds(ids.slice(0, 200));
    return NextResponse.json({
      leads: rows.map((row: any) => ({
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
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}
