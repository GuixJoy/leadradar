import { NextResponse } from 'next/server';
import { dbSearchLiveToday, dbSearchMain, dbSearchTesting } from '@/lib/db/store';

type LeadRow = {
  id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  has_360?: boolean | null;
  street_view_status?: string | null;
  category?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  score?: number | null;
  status?: string | null;
  last_enriched_at?: string | null;
  has_website?: boolean | null;
  business_status?: string | null;
  enrichment_completed?: boolean | null;
  times_seen?: number | null;
  country?: string | null;
  created_at?: string | null;
};

const MAX_RESULTS = 200;

const buildSearchFilter = (query: string) => {
  const escaped = query.replace(/%/g, '\\%');
  const term = `%${escaped}%`;
  return [
    `name.ilike.${term}`,
    `address.ilike.${term}`,
    `phone.ilike.${term}`,
    `website.ilike.${term}`,
    `category.ilike.${term}`
  ].join(',');
};

const mapLeadRow = (row: any) => ({
  id: row.id,
  name: row.name || 'Unknown',
  lat: row.lat,
  lng: row.lng,
  address: row.address,
  phone: row.phone,
  website: row.website,
  has_360: row.has_360 ?? false,
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
  country: row.country,
  created_at: row.created_at
});

const mapTestingRow = (row: any) => ({
  id: row.id,
  name: row.name || 'Unknown',
  lat: row.lat,
  lng: row.lng,
  address: row.address,
  phone: row.phone,
  website: row.website,
  has_360: row.street_view_status === 'HAS_360',
  streetViewStatus: row.street_view_status || undefined,
  category: row.category,
  rating: row.rating,
  reviews_count: row.reviews_count,
  status: 'READY',
  country: row.country,
  created_at: row.created_at
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body?.query || '').trim();
    const scope = String(body?.scope || 'main');
    const sessionId = body?.sessionId ? String(body.sessionId) : null;

    if (!query) {
      return NextResponse.json({ leads: [], count: 0 });
    }

    if (scope === 'testing') {
      const rows = await dbSearchTesting(query, MAX_RESULTS);

      return NextResponse.json({
        leads: rows.map(mapTestingRow),
        count: rows.length
      });
    }

    if (scope === 'today' || scope === 'live') {
      if (scope === 'live' && !sessionId) {
        return NextResponse.json({ leads: [], count: 0 });
      }

      const rows = await dbSearchLiveToday(query, scope, sessionId, MAX_RESULTS);
      const leads = rows.map(mapLeadRow);

      return NextResponse.json({
        leads,
        count: leads.length
      });
    }

    const rows = await dbSearchMain(query, MAX_RESULTS);

    return NextResponse.json({
      leads: rows.map(mapLeadRow),
      count: rows.length
    });
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
