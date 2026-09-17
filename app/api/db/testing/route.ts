import { NextResponse } from 'next/server';
import { dbListTesting } from '@/lib/db/store';

export async function GET() {
  try {
    const rows = await dbListTesting();
    const leads = rows.map((row: any) => ({
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
      created_at: row.created_at,
    }));
    return NextResponse.json({ leads, count: leads.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}
