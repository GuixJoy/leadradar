import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function generateInitialPoints(centerLat: number, centerLng: number) {
  const points = [{ lat: centerLat, lng: centerLng }];
  const spacing = 250; // Distance: 200-300 meters

  const latOffsetPerMeter = 1 / 111320;
  const lngOffsetPerMeter = 1 / (111320 * Math.cos(centerLat * Math.PI / 180));

  // 8 surrounding points (N, NE, E, SE, S, SW, W, NW)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 2 * Math.PI;
    const dy = Math.sin(angle) * spacing;
    const dx = Math.cos(angle) * spacing;
    points.push({
      lat: centerLat + (dy * latOffsetPerMeter),
      lng: centerLng + (dx * lngOffsetPerMeter)
    });
  }

  return points;
}

function generateSubPoints(centerLat: number, centerLng: number) {
  const points = [];
  const numPoints = 4;
  const spacing = 150; // smaller spacing for sub-points

  const latOffsetPerMeter = 1 / 111320;
  const lngOffsetPerMeter = 1 / (111320 * Math.cos(centerLat * Math.PI / 180));

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const dy = Math.sin(angle) * spacing;
    const dx = Math.cos(angle) * spacing;
    points.push({
      lat: centerLat + (dy * latOffsetPerMeter),
      lng: centerLng + (dx * lngOffsetPerMeter)
    });
  }

  return points;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function POST(request: Request) {
  try {
    const bodyReq = await request.json();
    const { lat, lng, radius, category, pageToken } = bodyReq || {};

    console.log("SEARCH INPUT:", { lat, lng, radius, category, pageToken });

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Invalid or missing lat/lng" }, { status: 400 });
    }

    const safeRadius = Number(radius) > 0 ? Math.min(Number(radius), 50000) : 2000;
    const safeCategory = category && category.trim() ? category.trim() : "restaurant";

    // STEP 1: Query Supabase
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('category', safeCategory);

    // STEP 2: Filter leads within radius
    const nearbyLeads = (existingLeads || []).filter((lead: any) => {
      if (!lead.lat || !lead.lng) return false;
      return getDistance(lat, lng, lead.lat, lead.lng) <= safeRadius;
    });

    // STEP 3: Cache decision
    if (nearbyLeads.length >= 20) {
      console.log(`Cache HIT! Found ${nearbyLeads.length} existing leads in DB.`);
      return NextResponse.json({
        leads: nearbyLeads.map((l: any) => ({
          id: l.id,
          name: l.name,
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          status: l.status,
          has_360: l.has_360 ?? false,
          last_enriched_at: l.last_enriched_at || null,
          streetViewStatus: l.streetViewStatus || undefined
        })),
        nextPageToken: null
      });
    }

    // STEP 4: Else Call Google API
    const url = "https://places.googleapis.com/v1/places:searchText";
    const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
    
    let rawPlaces: any[] = [];
    const seenIds = new Set<string>();
    let apiCalls = 0;
    const MAX_API_CALLS = 40;

    const fetchPlaces = async (point: {lat: number, lng: number}, pageToken?: string) => {
      const body: any = {
        textQuery: safeCategory,
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: point.lat, longitude: point.lng },
            radius: 350
          }
        }
      };
      if (pageToken) body.pageToken = pageToken;

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,nextPageToken"
          },
          body: JSON.stringify(body)
        });
        apiCalls++;
        if (!resp.ok) return { places: [], nextPageToken: null };
        const data = await resp.json();
        return { places: data.places || [], nextPageToken: data.nextPageToken || null };
      } catch (e) {
        apiCalls++;
        return { places: [], nextPageToken: null };
      }
    };

    if (pageToken) {
      // Single explicitly requested page fetch
      const res = await fetchPlaces({ lat, lng }, pageToken);
      rawPlaces = res.places;
    } else {
      // Queue-based scanning
      const queue = generateInitialPoints(lat, lng);
      let pointIndexCounter = 0;
      
      while (queue.length > 0 && apiCalls < MAX_API_CALLS) {
        // Take a batch of up to 3 points
        const batch = queue.splice(0, 3);
        
        // Ensure we don't exceed max API calls with this batch
        const availableCalls = MAX_API_CALLS - apiCalls;
        const actualBatch = batch.slice(0, availableCalls);
        
        if (actualBatch.length === 0) break;

        const promises = actualBatch.map(async (point) => {
          const currentPointIdx = pointIndexCounter++;
          let pointPlaces: any[] = [];
          
          // Check distance to ensure we don't drift too far from original center
          const distFromCenter = getDistance(lat, lng, point.lat, point.lng);
          if (distFromCenter > safeRadius) return [];

          const res1 = await fetchPlaces(point);
          const results1 = res1.places;
          pointPlaces = pointPlaces.concat(results1);

          let newUniqueLeads = 0;
          let duplicateCount = 0;

          for (const p of results1) {
            if (!p.id) continue;
            if (seenIds.has(p.id)) {
              duplicateCount++;
            } else {
              seenIds.add(p.id);
              newUniqueLeads++;
            }
          }

          const resultCount = results1.length;
          const duplicateRate = resultCount > 0 ? duplicateCount / resultCount : 0;

          // Pagination logic (Fetch up to 3 pages total)
          // Removed resultCount conditions to maximize retrieval per point
          if (res1.nextPageToken && apiCalls < MAX_API_CALLS) {
            await delay(2000);
            const res2 = await fetchPlaces(point, res1.nextPageToken);
            const results2 = res2.places;
            pointPlaces = pointPlaces.concat(results2);
            
            for (const p of results2) {
              if (!p.id) continue;
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                newUniqueLeads++;
              }
            }

            if (res2.nextPageToken && apiCalls < MAX_API_CALLS) {
              await delay(2000);
              const res3 = await fetchPlaces(point, res2.nextPageToken);
              const results3 = res3.places;
              pointPlaces = pointPlaces.concat(results3);
              
              for (const p of results3) {
                if (!p.id) continue;
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  newUniqueLeads++;
                }
              }
            }
          }

          // Expansion logic
          if (resultCount > 15 && duplicateRate < 0.6 && newUniqueLeads > 8) {
             const subPoints = generateSubPoints(point.lat, point.lng);
             queue.push(...subPoints);
          }

          return pointPlaces;
        });

        const batchResults = await Promise.all(promises);
        rawPlaces = rawPlaces.concat(batchResults.flat());

        if (queue.length > 0 && apiCalls < MAX_API_CALLS) {
          await delay(300); // 300ms delay between batches
        }
      }
      
      // We already updated seenIds during the fetch, but rawPlaces might have duplicates 
      // if multiple points fetched the same place in the same batch or if we just collected them.
      // We need to deduplicate rawPlaces.
      const finalSeen = new Set<string>();
      rawPlaces = rawPlaces.filter((p: any) => {
        if (!p.id || finalSeen.has(p.id)) return false;
        finalSeen.add(p.id);
        return true;
      });
    }

    const validPlaces = rawPlaces.filter((p: any) => {
      const pLat = p.location?.latitude;
      const pLng = p.location?.longitude;
      if (!pLat || !pLng) return false;
      const distance = getDistance(lat, lng, pLat, pLng);
      return distance <= safeRadius;
    });

    const leads = validPlaces.map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || "Unknown",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      address: p.formattedAddress || "",
      status: "DISCOVERED",
      phone: p.nationalPhoneNumber || null,
      website: p.websiteUri || null,
      has360: false,
      category: safeCategory,
      rating: p.rating || null,
      reviews_count: p.userRatingCount || 0,
      score: 0
    }));

    const formattedLeads = leads
      .filter((l: any) => l.id && l.lat && l.lng)
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        address: l.address || null,
        phone: l.phone || null,
        website: l.website || null,
        has_360: l.has360 || false,
        has_phone: !!l.phone,
        has_website: !!l.website,
        category: l.category || "unknown",
        rating: l.rating || null,
        reviews_count: l.reviews_count || 0,
        score: l.score || 0,
        status: "DISCOVERED",
        created_at: new Date().toISOString(),
        last_enriched_at: null
      }));

    if (formattedLeads.length > 0) {
      console.log("Leads to insert:", formattedLeads.length);
      const { data, error } = await supabase
        .from('leads')
        .upsert(formattedLeads, { onConflict: 'id', ignoreDuplicates: true })
        .select();
        
      if (error) {
        console.error("Insert error:", error);
      } else {
        console.log("Insert success:", data?.length, "records");
      }
    }

    let dbLeadsMap = new Map();
    if (formattedLeads.length > 0) {
      const placeIds = formattedLeads.map((l: any) => l.id);
      const { data: existingLeads } = await supabase.from('leads').select('*').in('id', placeIds);
      if (existingLeads) {
        existingLeads.forEach(row => dbLeadsMap.set(row.id, row));
      }
    }

    const newLeadsFormatted = leads.map((l: any) => {
      const dbInfo = dbLeadsMap.get(l.id) || {};
      return {
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        address: l.address,
        status: dbInfo.status || l.status,
        has_360: dbInfo.has_360 ?? false,
        last_enriched_at: dbInfo.last_enriched_at || null,
        streetViewStatus: dbInfo.streetViewStatus || undefined
      };
    });

    // STEP 5: Return combined results
    const finalMap = new Map();
    nearbyLeads.forEach((l: any) => finalMap.set(l.id, l));
    newLeadsFormatted.forEach((l: any) => finalMap.set(l.id, l));

    return NextResponse.json({
      leads: Array.from(finalMap.values()),
      nextPageToken: null
    });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
