import { NextResponse } from 'next/server';
import { dbCreateScrapeSession, dbListSessions } from '@/lib/db/store';

// GET /api/db/sessions — list newest first
export async function GET() {
  try {
    const rows = await dbListSessions();
    return NextResponse.json({ sessions: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'fetch failed' }, { status: 500 });
  }
}

// POST /api/db/sessions {location, category, radius} — create + return id
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const row = await dbCreateScrapeSession({
      location: String(body.location || ''),
      category: String(body.category || ''),
      radius: Number(body.radius || 0),
    });
    if (!row) return NextResponse.json({ error: 'create failed' }, { status: 500 });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'create failed' }, { status: 500 });
  }
}
