import { NextResponse } from 'next/server';

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Radius of the earth in m
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in m
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ status: "NO_360", avgDistance: null, okCount: 0 }, { status: 400 });
    }

    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

    if (cache.has(key)) {
      const cached = cache.get(key);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_PLACES_API_KEY is missing");
      return NextResponse.json({ status: "NO_360", avgDistance: null, okCount: 0 });
    }

    const offsets = [
      { latOffset: 0, lngOffset: 0 },
      { latOffset: 0.00005, lngOffset: 0 },
      { latOffset: -0.00005, lngOffset: 0 },
      { latOffset: 0, lngOffset: 0.00005 },
      { latOffset: 0, lngOffset: -0.00005 },
    ];

    const fetchPromises = offsets.map(async ({ latOffset, lngOffset }) => {
      const checkLat = lat + latOffset;
      const checkLng = lng + lngOffset;
      const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${checkLat},${checkLng}&key=${apiKey}`;
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.status !== "OK") return null;

        const panoLat = data.location.lat;
        const panoLng = data.location.lng;
        const panoId = data.pano_id;
        const distance = getDistanceFromLatLonInM(lat, lng, panoLat, panoLng);
        
        return { panoId, panoLat, panoLng, distance };
      } catch (e) {
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    const validPanos = results.filter((p) => p !== null) as { panoId: string, panoLat: number, panoLng: number, distance: number }[];

    let streetViewStatus = "NO_STRONG_360";
    let nearestDistance: number | null = null;
    let uniquePanosCount = 0;

    if (validPanos.length > 0) {
      nearestDistance = Math.min(...validPanos.map(p => p.distance));
      const uniqueIds = new Set(validPanos.map(p => p.panoId));
      uniquePanosCount = uniqueIds.size;

      if (nearestDistance > 10) {
        streetViewStatus = "NO_STRONG_360";
      } else if (uniquePanosCount > 1) {
        streetViewStatus = "POSSIBLE_360";
      } else {
        streetViewStatus = "ROAD_ONLY";
      }
    }

    const result = { 
      status: streetViewStatus,
      okCount: uniquePanosCount,
      avgDistance: nearestDistance !== null ? Math.round(nearestDistance) : null
    };

    cache.set(key, {
      data: result,
      timestamp: Date.now()
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error checking streetview:", error);
    return NextResponse.json({ status: "NO_360", avgDistance: null, okCount: 0 });
  }
}
