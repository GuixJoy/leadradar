import { NextResponse } from 'next/server';
import { getServerProvider, isPgConfigured, isSupabaseConfigured } from '@/lib/db/provider';

export async function GET() {
  let provider: string;
  try {
    provider = getServerProvider();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    provider,
    pg: isPgConfigured(),
    supabase: isSupabaseConfigured(),
    realtime: isSupabaseConfigured(), // realtime only via Supabase; PG mode polls
  });
}
