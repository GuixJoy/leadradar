// Client-side data layer.
// Uses Supabase JS directly (with realtime) when NEXT_PUBLIC_SUPABASE_* is set.
// Falls back to /api/db/* REST (plain Postgres) otherwise — polling replaces realtime.
import { supabase } from './supabase';

export function clientUsesSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function dcFetchMain(page = 1, pageSize = 50): Promise<{ leads: any[]; total: number | null; hasMore: boolean }> {
  if (clientUsesSupabase()) {
    const { data, error, count } = await supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    return { leads: (data || []).map(mapLead), total: count ?? null, hasMore: count != null ? page * pageSize < count : (data || []).length === pageSize };
  }
  const res = await fetch(`/api/db/leads?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) throw new Error('main fetch failed');
  const json = await res.json();
  const total = typeof json.total === 'number' ? json.total : null;
  return { leads: json.leads || [], total, hasMore: total != null ? page * pageSize < total : (json.leads || []).length === pageSize };
}

export async function dcFetchToday(): Promise<any[]> {
  if (clientUsesSupabase()) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: mapData, error: mapError } = await supabase
      .from('lead_scrape_map')
      .select('lead_id')
      .gte('scraped_at', today.toISOString())
      .order('scraped_at', { ascending: false });
    if (mapError || !mapData || mapData.length === 0) {
      if (mapError) {
        const { data } = await supabase.from('leads').select('*').gte('created_at', today.toISOString()).order('created_at', { ascending: false });
        return (data || []).map(mapLead);
      }
      return [];
    }
    const ids = [...new Set(mapData.map((r: any) => r.lead_id))];
    const { data } = await supabase.from('leads').select('*').in('id', ids);
    return (data || []).map(mapLead);
  }
  const res = await fetch('/api/db/today');
  if (!res.ok) throw new Error('today fetch failed');
  return (await res.json()).leads || [];
}

export async function dcFetchTesting(): Promise<any[]> {
  if (clientUsesSupabase()) {
    const { data, error } = await supabase.from('testing').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTesting);
  }
  const res = await fetch('/api/db/testing');
  if (!res.ok) throw new Error('testing fetch failed');
  return (await res.json()).leads || [];
}

export async function dcFetchSessions(): Promise<any[]> {
  if (clientUsesSupabase()) {
    const { data, error } = await supabase.from('scrape_sessions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  const res = await fetch('/api/db/sessions');
  if (!res.ok) throw new Error('sessions fetch failed');
  return (await res.json()).sessions || [];
}

export async function dcCreateSession(input: { location: string; category: string; radius: number }): Promise<{ id: string } | null> {
  if (clientUsesSupabase()) {
    const { data, error } = await supabase.from('scrape_sessions').insert(input).select('id').single();
    if (error) throw error;
    return data;
  }
  const res = await fetch('/api/db/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error('session create failed');
  return res.json();
}

export async function dcSessionLeadIds(sessionId: string): Promise<string[]> {
  if (clientUsesSupabase()) {
    const { data } = await supabase.from('lead_scrape_map').select('lead_id').eq('session_id', sessionId);
    return (data || []).map((d: any) => d.lead_id);
  }
  const res = await fetch(`/api/db/session-leads?sessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return [];
  return (await res.json()).leadIds || [];
}

export async function dcFetchLead(id: string): Promise<any | null> {
  if (clientUsesSupabase()) {
    const { data } = await supabase.from('leads').select('*').eq('id', id).single();
    return data ? mapLead(data) : null;
  }
  const res = await fetch(`/api/db/lead?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return (await res.json()).lead || null;
}

export async function dcPatchLead(id: string, fields: Record<string, any>): Promise<void> {
  if (clientUsesSupabase()) {
    const { error } = await supabase.from('leads').update(fields).eq('id', id);
    if (error) throw error;
    return;
  }
  await fetch('/api/db/lead', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, fields }) });
}

export function mapLead(row: any) {
  return {
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
  };
}

export function mapTesting(row: any) {
  return {
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
  };
}
