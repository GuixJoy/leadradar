import {
  dbCountSessionLeads,
  dbGetExistingMeta,
  dbGetLeadsByCategory,
  dbGetLeadsByIds,
  dbIncrementTimesSeen,
  dbUpdateSessionTotal,
  dbUpsertLeads,
  dbUpsertScrapeMap,
} from '@/lib/db/store';
import { resolveCategoryCluster } from '@/lib/category-clusters';
import {
  getCategoryIntent,
  isGenericPlaceType,
  normalizeIntentToken
} from '@/lib/category-intents';
import {
  DEFAULT_DENSE_RESULT_THRESHOLD,
  DEFAULT_INTERNAL_CELL_RADIUS,
  DEFAULT_GRID_OVERLAP,
  DEFAULT_MAX_GRID_DEPTH,
  generateGrid,
  INTERNAL_CELL_RADIUS_MAX,
  INTERNAL_CELL_RADIUS_MIN,
  subdivideCell
} from '@/lib/discovery/grid';
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

function generateSubPoints(centerLat: number, centerLng: number, numPoints = 4, spacing = 150) {
  const points = [];

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

const MAX_API_CALLS = 40;
const MIN_RESULTS_BEFORE_FALLBACK = 25;
const MIN_RESULTS_BEFORE_TEXT_FALLBACK = 10;
const MIN_CALLS_PER_QUERY = 4;
const MAX_GRID_DEPTH = DEFAULT_MAX_GRID_DEPTH;
const MAX_GRID_CELLS = 80;
const MAX_CELL_SCANS = 120;
const GRID_OVERLAP = DEFAULT_GRID_OVERLAP;
const DENSE_RESULT_THRESHOLD = DEFAULT_DENSE_RESULT_THRESHOLD;
const MIN_CELL_RADIUS = INTERNAL_CELL_RADIUS_MIN;
const MAX_CELL_RADIUS = INTERNAL_CELL_RADIUS_MAX;
const MAX_CELL_CONCURRENCY = 3;
const MAX_FETCH_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DEBUG_DISCOVERY = true;
const RADIUS_BUFFER_MULTIPLIER = 1.65;
const MAX_RADIUS_BUFFER_METERS = 1200;

const clampSearchRadius = (radiusMeters: number) => Math.max(200, Math.min(radiusMeters, 1200));

const getEffectiveRadius = (userRadius: number) => Math.min(
  userRadius * RADIUS_BUFFER_MULTIPLIER,
  userRadius + MAX_RADIUS_BUFFER_METERS
);

const getNoisyReason = (place: any) => {
  const name = place?.displayName?.text?.trim();
  const address = place?.formattedAddress?.trim();
  const phone = place?.nationalPhoneNumber?.trim();
  const website = place?.websiteUri?.trim();
  if (name || address || phone || website) return null;
  return 'missing_name_address_phone_website';
};

const isNoisyPlace = (place: any) => !!getNoisyReason(place);

const getPlaceDebug = (place: any) => ({
  id: place?.id || null,
  name: place?.displayName?.text || place?.name || null,
  types: place?.types || null,
  businessStatus: place?.businessStatus || null
});

const logRejection = (stage: string, reason: string, place: any, extra?: Record<string, unknown>) => {
  if (!DEBUG_DISCOVERY) return;
  console.log('REJECTED', { stage, reason, ...getPlaceDebug(place), ...extra });
};

const isPermanentlyClosed = (place: any) => {
  const status = String(place?.businessStatus || '').toUpperCase();
  return status === 'CLOSED_PERMANENTLY';
};

const matchesCategoryIntent = (place: any, category: string, querySignal?: string) => {
  const intentInfo = getCategoryIntent(category);
  if (!intentInfo) return true;

  const intent = intentInfo.intent;
  const acceptedTypes = intent.acceptedTypes.map(normalizeIntentToken);
  const discoveryTerms = intent.discoveryTerms.map(normalizeIntentToken);
  const nameKeywords = intent.nameKeywords.map(normalizeIntentToken);

  const types = Array.isArray(place?.types) ? place.types.map(normalizeIntentToken) : [];
  const name = normalizeIntentToken(place?.displayName?.text || place?.name || "");
  const query = normalizeIntentToken(querySignal || "");

  const matchedTypes = types.filter((type) => acceptedTypes.includes(type));
  const matchedNonGenericTypes = matchedTypes.filter((type) => !isGenericPlaceType(type));
  const matchedKeywords = nameKeywords.filter((keyword) => keyword && name.includes(keyword));
  const matchedTerms = discoveryTerms.filter((term) => term && query.includes(term));

  let score = 0;
  const matchedSignals: string[] = [];

  if (matchedNonGenericTypes.length > 0) {
    score += 2;
    matchedSignals.push('accepted_types');
  } else if (matchedTypes.length > 0) {
    score += 1;
    matchedSignals.push('generic_type');
  }

  if (matchedKeywords.length > 0) {
    score += 1;
    matchedSignals.push('name_keyword');
  }

  if (matchedTerms.length > 0) {
    score += 1;
    matchedSignals.push('query_signal');
  }

  const classificationConfidence = score >= 3 ? 'high' : score === 2 ? 'medium' : score === 1 ? 'low' : 'none';
  const accepted = score >= 2;

  if (DEBUG_DISCOVERY) {
    console.log('SEMANTIC_CLASSIFY', {
      intent: intentInfo.key,
      classificationConfidence,
      matchedSignals,
      matchedTypes,
      matchedKeywords,
      matchedTerms,
      ...getPlaceDebug(place)
    });
  }

  if (!accepted) {
    logRejection('semantic_validation', 'insufficient_intent_signals', place, {
      intent: intentInfo.key,
      classificationConfidence,
      matchedSignals,
      matchedTypes,
      matchedKeywords,
      matchedTerms
    });
  }

  return accepted;
};

function allocateQueryBudgets(weights: number[], maxCalls: number, minCalls: number) {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const budgets = weights.map((weight) => Math.max(minCalls, Math.floor((maxCalls * weight) / totalWeight)));
  let total = budgets.reduce((sum, value) => sum + value, 0);
  if (total > maxCalls) {
    let index = budgets.length - 1;
    while (total > maxCalls && index >= 0) {
      if (budgets[index] > minCalls) {
        budgets[index] -= 1;
        total -= 1;
      } else {
        index -= 1;
      }
    }
  } else if (total < maxCalls) {
    budgets[0] += (maxCalls - total);
  }
  return budgets;
}

async function processAndUpsertBatch(rawPlacesBatch: any[], lat: number, lng: number, safeRadius: number, safeCategory: string, sessionId: string | null) {
  const effectiveRadius = getEffectiveRadius(safeRadius);
  const finalSeen = new Set<string>();
  const validPlaces = rawPlacesBatch.filter((p: any) => {
    if (!p.id) {
      logRejection('batch_validation', 'missing_place_id', p);
      return false;
    }
    if (finalSeen.has(p.id)) {
      logRejection('batch_dedupe', 'duplicate_place_id', p);
      return false;
    }
    const noisyReason = getNoisyReason(p);
    if (noisyReason) {
      logRejection('batch_noisy_filter', noisyReason, p);
      return false;
    }
    if (isPermanentlyClosed(p)) {
      logRejection('batch_status_filter', 'closed_permanently', p);
      return false;
    }
    if (!matchesCategoryIntent(p, safeCategory)) {
      return false;
    }
    finalSeen.add(p.id);
    const pLat = p.location?.latitude;
    const pLng = p.location?.longitude;
    if (!pLat || !pLng) {
      logRejection('batch_validation', 'missing_lat_lng', p);
      return false;
    }
    const distance = getDistance(lat, lng, pLat, pLng);
    if (distance > effectiveRadius) {
      logRejection('batch_validation', 'outside_radius', p, {
        distance,
        userRadius: safeRadius,
        effectiveRadius
      });
      return false;
    }
    return true;
  });

  if (validPlaces.length === 0) return;

  const formattedLeads = validPlaces.map((p: any) => ({
    id: p.id,
    name: p.displayName?.text || "Unknown",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    address: p.formattedAddress || null,
    phone: p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
    has_360: false,
    has_phone: !!p.nationalPhoneNumber,
    has_website: !!p.websiteUri,
    category: safeCategory,
    rating: p.rating || null,
    reviews_count: p.userRatingCount || 0,
    score: 0,
    status: "DISCOVERED",
    created_at: new Date().toISOString(),
    last_enriched_at: null,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    times_seen: 1
  }));

  const placeIds = formattedLeads.map((l: any) => l.id);
  const existingMap = await dbGetExistingMeta(placeIds);

  const finalLeadsToUpsert = formattedLeads.map((l: any) => {
     const existing = existingMap.get(l.id);
     if (existing) {
       return {
         ...l,
         first_seen_at: existing.first_seen_at || l.first_seen_at,
         last_seen_at: new Date().toISOString(),
         times_seen: (existing.times_seen || 1) + 1
       };
     }
     return l;
  });

  try {
    await dbUpsertLeads(finalLeadsToUpsert);
  } catch (e) {
    console.error('leads upsert failed', e);
  }
  if (sessionId) {
    const sessionMapRows = finalLeadsToUpsert.map((l: any) => ({
      lead_id: l.id,
      session_id: sessionId
    }));
    await dbUpsertScrapeMap(sessionMapRows);

    // Update total_results count
    const count = await dbCountSessionLeads(sessionId);
    await dbUpdateSessionTotal(sessionId, count);
  }
}

export async function POST(request: Request) {
  try {
    const bodyReq = await request.json();
    const { lat, lng, radius, category, pageToken, sessionId } = bodyReq || {};

    console.log("SEARCH INPUT:", { lat, lng, radius, category, pageToken, sessionId });

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Invalid or missing lat/lng" }, { status: 400 });
    }

    const safeRadius = Number(radius) > 0 ? Math.min(Number(radius), 50000) : 2000;
    const effectiveRadius = getEffectiveRadius(safeRadius);
    const safeCategory = category && category.trim() ? category.trim() : "restaurant";

    // STEP 1: Query DB (Postgres or Supabase via store)
    const existingLeads = await dbGetLeadsByCategory(safeCategory);

    // STEP 2: Filter leads within radius
    const nearbyLeads = (existingLeads || []).filter((lead: any) => {
      if (!lead.lat || !lead.lng) return false;
      return getDistance(lat, lng, lead.lat, lead.lng) <= safeRadius;
    });

    // STEP 3: Cache tracking (do not short-circuit discovery)
    if (nearbyLeads.length >= 20) {
      console.log(`Cache HIT! Found ${nearbyLeads.length} existing leads in DB.`);
      
      // Update session map for cached leads if sessionId provided
      if (sessionId) {
        const sessionMapRows = nearbyLeads.map((l: any) => ({
          lead_id: l.id,
          session_id: sessionId
        }));
        await dbUpsertScrapeMap(sessionMapRows);

        // Also update times_seen and last_seen_at
        for (const l of nearbyLeads) {
          await dbIncrementTimesSeen(l.id, l.times_seen);
        }

        // Update session total_results
        const count = await dbCountSessionLeads(sessionId);
        await dbUpdateSessionTotal(sessionId, count);
      }
    }

    // STEP 4: Else Call Google API
    const url = "https://places.googleapis.com/v1/places:searchText";
    const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
    
    let rawPlaces: any[] = [];
    const seenIds = new Set<string>();
    let apiCalls = 0;

    const runRequestWithRetry = async (request: () => Promise<Response>) => {
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
        try {
          const resp = await request();
          apiCalls++;
          if (resp.ok) return { ok: true, resp };
          if (!RETRYABLE_STATUS.has(resp.status) || attempt === MAX_FETCH_RETRIES) {
            return { ok: false, resp };
          }
        } catch (error) {
          apiCalls++;
          lastError = error;
          if (attempt === MAX_FETCH_RETRIES) break;
        }

        await delay(250 * attempt);
      }

      console.warn('Places API retry exhausted', lastError);
      return { ok: false, resp: null as Response | null };
    };

    const fetchTextPlaces = async (point: {lat: number, lng: number}, textQuery: string, radiusMeters: number, pageToken?: string) => {
      const body: any = {
        textQuery,
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: point.lat, longitude: point.lng },
            radius: clampSearchRadius(radiusMeters)
          }
        }
      };
      if (pageToken) body.pageToken = pageToken;

      const { ok, resp } = await runRequestWithRetry(() => fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.userRatingCount,nextPageToken"
        },
        body: JSON.stringify(body)
      }));

      if (!ok || !resp) return { places: [], nextPageToken: null };
      const data = await resp.json();
      return { places: data.places || [], nextPageToken: data.nextPageToken || null };
    };

    const fetchNearbyPlaces = async (point: {lat: number, lng: number}, includedType: string, radiusMeters: number, pageToken?: string) => {
      const body: any = {
        includedTypes: [includedType],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: point.lat, longitude: point.lng },
            radius: clampSearchRadius(radiusMeters)
          }
        }
      };
      if (pageToken) body.pageToken = pageToken;

      const { ok, resp } = await runRequestWithRetry(() => fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.userRatingCount,nextPageToken"
        },
        body: JSON.stringify(body)
      }));

      if (!ok || !resp) return { places: [], nextPageToken: null };
      const data = await resp.json();
      return { places: data.places || [], nextPageToken: data.nextPageToken || null };
    };

    type DiscoveryMeta = {
      cellId: string;
      depth: number;
      query: string;
      center: { lat: number; lng: number };
      radius: number;
    };

    const discoveryMeta = new Map<string, DiscoveryMeta>();

    const registerNewPlaces = (places: any[], meta?: DiscoveryMeta) => {
      const newPlaces: any[] = [];
      let duplicateCount = 0;
      for (const p of places) {
        if (!p?.id) {
          logRejection('register', 'missing_place_id', p);
          continue;
        }
        if (seenIds.has(p.id)) {
          duplicateCount += 1;
          logRejection('register_dedupe', 'duplicate_place_id', p);
          continue;
        }
        seenIds.add(p.id);
        if (meta && !discoveryMeta.has(p.id)) {
          discoveryMeta.set(p.id, meta);
        }
        newPlaces.push(p);
      }
      return { newPlaces, duplicateCount };
    };

    const baseCellRadius = Math.min(
      Math.max(safeRadius / 3, MIN_CELL_RADIUS || DEFAULT_INTERNAL_CELL_RADIUS),
      MAX_CELL_RADIUS || DEFAULT_INTERNAL_CELL_RADIUS
    );
    const baseGridCells = generateGrid(
      { lat, lng, radius: safeRadius },
      { cellRadiusMeters: baseCellRadius, overlapPercent: GRID_OVERLAP, maxCells: MAX_GRID_CELLS }
    );

    const scanQuery = async (
      query: string,
      perQueryLimit: number,
      fetcher: (point: {lat: number, lng: number}, query: string, radiusMeters: number, pageToken?: string) => Promise<{ places: any[], nextPageToken: string | null }>
    ) => {
      const cellQueue = baseGridCells.map((cell) => ({
        ...cell,
        bounds: cell.bounds
      }));
      const startCalls = apiCalls;
      const queryNewPlaces: any[] = [];
      let scannedCells = 0;

      while (cellQueue.length > 0 && apiCalls < MAX_API_CALLS && (apiCalls - startCalls) < perQueryLimit && scannedCells < MAX_CELL_SCANS) {
        const batch = cellQueue.splice(0, MAX_CELL_CONCURRENCY);
        const remainingCalls = Math.min(MAX_API_CALLS - apiCalls, perQueryLimit - (apiCalls - startCalls));
        const actualBatch = batch.slice(0, Math.min(batch.length, remainingCalls));

        if (actualBatch.length === 0) break;

        const promises = actualBatch.map(async (cell) => {
          try {
          if (scannedCells >= MAX_CELL_SCANS) return [];
          scannedCells += 1;
          let cellNewPlaces: any[] = [];
          let cellResultCount = 0;
          const cellSeen = new Set<string>();
          const cellMeta: DiscoveryMeta = {
            cellId: cell.id,
            depth: cell.depth,
            query,
            center: cell.center,
            radius: cell.radius
          };

          const runPage = async (pageToken?: string) => {
            const res = await fetcher(cell.center, query, cell.radius, pageToken);
            const results = res.places;
            cellResultCount += results.length;
            for (const p of results) {
              if (!p?.id) continue;
              cellSeen.add(p.id);
            }
            const registered = registerNewPlaces(results, cellMeta);
            cellNewPlaces = cellNewPlaces.concat(registered.newPlaces);
            return res.nextPageToken;
          };

          const distFromCenter = getDistance(lat, lng, cell.center.lat, cell.center.lng);
          if (distFromCenter > safeRadius + cell.radius) return [];

          let nextToken = await runPage();
          if (nextToken && apiCalls < MAX_API_CALLS && (apiCalls - startCalls) < perQueryLimit) {
            await delay(2000);
            nextToken = await runPage(nextToken);
          }
          if (nextToken && apiCalls < MAX_API_CALLS && (apiCalls - startCalls) < perQueryLimit) {
            await delay(2000);
            await runPage(nextToken);
          }

          if (cell.depth < MAX_GRID_DEPTH && cellResultCount >= DENSE_RESULT_THRESHOLD) {
            const remainingCells = MAX_GRID_CELLS - cellQueue.length;
            if (remainingCells > 0) {
              const subCells = subdivideCell(cell, GRID_OVERLAP).slice(0, remainingCells);
              cellQueue.push(...subCells);
            }
          }

          return cellNewPlaces;
          } catch (error) {
            console.warn('Cell scan failed', { cellId: cell.id, query, error });
            return [];
          }
        });

        const batchResults = await Promise.all(promises);
        const newBatchPlaces = batchResults.flat();
        if (newBatchPlaces.length > 0) {
          queryNewPlaces.push(...newBatchPlaces);
          await processAndUpsertBatch(newBatchPlaces, lat, lng, safeRadius, safeCategory, sessionId);
        }

        if (cellQueue.length > 0 && apiCalls < MAX_API_CALLS) {
          await delay(300);
        }
      }

      return queryNewPlaces;
    };

    const scanNearbyByType = async (type: string, queryLabel: string, perQueryLimit: number) => {
      return scanQuery(queryLabel, perQueryLimit, (point, _query, radiusMeters, pageToken) =>
        fetchNearbyPlaces(point, type, radiusMeters, pageToken)
      );
    };

    if (pageToken) {
      const res = await fetchTextPlaces({ lat, lng }, safeCategory, clampSearchRadius(MIN_CELL_RADIUS), pageToken);
      const registered = registerNewPlaces(res.places);
      rawPlaces = registered.newPlaces;
    } else {
      const clusterEntries = resolveCategoryCluster(safeCategory);
      const weights = clusterEntries.map((entry) => entry.weight);
      const budgets = allocateQueryBudgets(weights, MAX_API_CALLS, MIN_CALLS_PER_QUERY);
      const primaryEntry = clusterEntries.find((entry) => entry.isPrimary) || clusterEntries[0];
      const primaryQuery = primaryEntry?.query || safeCategory;
      let totalUnique = 0;

      for (let i = 0; i < clusterEntries.length && apiCalls < MAX_API_CALLS; i += 1) {
        if (i > 0 && totalUnique >= MIN_RESULTS_BEFORE_FALLBACK) break;
        const query = clusterEntries[i];
        const budget = Math.min(budgets[i], MAX_API_CALLS - apiCalls);
        if (!query.query || budget <= 0) continue;
        const newPlaces = query.isPrimary
          ? await scanNearbyByType(safeCategory, query.query, budget)
          : await scanQuery(query.query, budget, fetchTextPlaces);
        if (newPlaces.length > 0) {
          rawPlaces = rawPlaces.concat(newPlaces);
          totalUnique += newPlaces.length;
        }
      }

      if (totalUnique < MIN_RESULTS_BEFORE_TEXT_FALLBACK && apiCalls < MAX_API_CALLS) {
        const remaining = Math.min(MIN_CALLS_PER_QUERY, MAX_API_CALLS - apiCalls);
        if (remaining > 0) {
          const textPlaces = await scanQuery(primaryQuery, remaining, fetchTextPlaces);
          if (textPlaces.length > 0) {
            rawPlaces = rawPlaces.concat(textPlaces);
          }
        }
      }

      const finalSeen = new Set<string>();
      rawPlaces = rawPlaces.filter((p: any) => {
        if (!p?.id) {
          logRejection('raw_dedupe', 'missing_place_id', p);
          return false;
        }
        if (finalSeen.has(p.id)) {
          logRejection('raw_dedupe', 'duplicate_place_id', p);
          return false;
        }
        finalSeen.add(p.id);
        return true;
      });
    }

    const validPlaces = rawPlaces.filter((p: any) => {
      const pLat = p.location?.latitude;
      const pLng = p.location?.longitude;
      if (!pLat || !pLng) {
        logRejection('valid_filter', 'missing_lat_lng', p);
        return false;
      }
      const noisyReason = getNoisyReason(p);
      if (noisyReason) {
        logRejection('valid_filter', noisyReason, p);
        return false;
      }
      if (isPermanentlyClosed(p)) {
        logRejection('valid_filter', 'closed_permanently', p);
        return false;
      }
      const discovery = discoveryMeta.get(p.id);
      if (!matchesCategoryIntent(p, safeCategory, discovery?.query)) {
        return false;
      }
      const distance = getDistance(lat, lng, pLat, pLng);
      if (distance > effectiveRadius) {
        logRejection('valid_filter', 'outside_radius', p, {
          distance,
          userRadius: safeRadius,
          effectiveRadius
        });
        return false;
      }
      return true;
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
      .filter((l: any) => {
        if (!l.id) {
          logRejection('lead_format', 'missing_place_id', l);
          return false;
        }
        if (!l.lat || !l.lng) {
          logRejection('lead_format', 'missing_lat_lng', l);
          return false;
        }
        return true;
      })
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
        last_enriched_at: null,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        times_seen: 1
      }));

    if (formattedLeads.length > 0) {
      console.log("Leads to insert:", formattedLeads.length);

      // Retrieve existing from DB to properly increment times_seen for duplicates
      const placeIds = formattedLeads.map((l: any) => l.id);
      const existingMap = await dbGetExistingMeta(placeIds);

      const finalLeadsToUpsert = formattedLeads.map((l: any) => {
         const existing = existingMap.get(l.id);
         if (existing) {
           return {
             ...l,
             first_seen_at: existing.first_seen_at || l.first_seen_at,
             last_seen_at: new Date().toISOString(),
             times_seen: (existing.times_seen || 1) + 1
           };
         }
         return l;
      });

      try {
        const data = await dbUpsertLeads(finalLeadsToUpsert);
        console.log("Insert success:", data?.length, "records");

        if (sessionId) {
          const sessionMapRows = finalLeadsToUpsert.map((l: any) => ({
            lead_id: l.id,
            session_id: sessionId
          }));
          await dbUpsertScrapeMap(sessionMapRows);

          // Update total_results count on the session
          // We can just fetch count of lead_scrape_map for this session
          const count = await dbCountSessionLeads(sessionId);
          await dbUpdateSessionTotal(sessionId, count);
        }
      } catch (error) {
        console.error("Insert error:", error);
      }
    }

    let dbLeadsMap = new Map();
    if (formattedLeads.length > 0) {
      const placeIds = formattedLeads.map((l: any) => l.id);
      const existingLeads = await dbGetLeadsByIds(placeIds);
      if (existingLeads) {
        existingLeads.forEach(row => dbLeadsMap.set(row.id, row));
      }
    }

    const newLeadsFormatted = leads.map((l: any) => {
      const dbInfo = dbLeadsMap.get(l.id) || {};
      const discovery = discoveryMeta.get(l.id);
      return {
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        address: l.address,
        status: dbInfo.status || l.status,
        has_360: dbInfo.has_360 ?? false,
        last_enriched_at: dbInfo.last_enriched_at || null,
        streetViewStatus: dbInfo.streetViewStatus || undefined,
        discovery: discovery || undefined
      };
    });

    // STEP 5: Return combined results
    const finalMap = new Map();
    nearbyLeads.forEach((l: any) => finalMap.set(l.id, l));
    newLeadsFormatted.forEach((l: any) => finalMap.set(l.id, l));

    console.log('Discovery summary', {
      cacheHits: nearbyLeads.length,
      rawDiscovered: rawPlaces.length,
      validDiscovered: validPlaces.length,
      uniqueLeadPayload: newLeadsFormatted.length,
      responseTotal: finalMap.size
    });

    return NextResponse.json({
      leads: Array.from(finalMap.values()),
      nextPageToken: null
    });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return NextResponse.json({ error: "Server error", details: e instanceof Error ? e.stack : String(e) }, { status: 500 });
  }
}
