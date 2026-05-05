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
      { latOffset: 0, lngOffset: 0 }, // center
      { latOffset: 0.00005, lngOffset: 0 }, // north
      { latOffset: -0.00005, lngOffset: 0 }, // south
      { latOffset: 0, lngOffset: 0.00005 }, // east
      { latOffset: 0, lngOffset: -0.00005 }, // west
      { latOffset: 0.00005, lngOffset: 0.00005 }, // northeast
      { latOffset: 0.00005, lngOffset: -0.00005 }, // northwest
    ];

    const uniquePanos = new Map<string, { lat: number, lng: number }>();

    const calculateMaxDistance = (panos: Map<string, { lat: number, lng: number }>) => {
      const panoList = Array.from(panos.values());
      if (panoList.length < 2) return 0;
      let maxDist = 0;
      for (let i = 0; i < panoList.length; i++) {
        for (let j = i + 1; j < panoList.length; j++) {
          const dist = getDistanceFromLatLonInM(
            panoList[i].lat, panoList[i].lng,
            panoList[j].lat, panoList[j].lng
          );
          if (dist > maxDist) maxDist = dist;
        }
      }
      return maxDist;
    };

    for (const offset of offsets) {
      const checkLat = lat + offset.latOffset;
      const checkLng = lng + offset.lngOffset;
      const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${checkLat},${checkLng}&key=${apiKey}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "OK" && data.pano_id) {
            uniquePanos.set(data.pano_id, {
              lat: data.location.lat,
              lng: data.location.lng
            });
          }
        }
      } catch (e) {
        // ignore fetch errors
      }

      // Early exit check: only if size >= 3 AND distance is between 8 and 40
      const currentMaxDist = calculateMaxDistance(uniquePanos);
      if (uniquePanos.size >= 3 && currentMaxDist > 8 && currentMaxDist < 40) {
        break;
      }
    }

    const finalMaxDist = calculateMaxDistance(uniquePanos);
    const has360 = uniquePanos.size >= 3 && finalMaxDist > 8 && finalMaxDist < 40;
    const status = has360 ? "HAS_360" : "NO_360";

    const result = { 
      status: status,
      okCount: uniquePanos.size,
      avgDistance: Math.round(finalMaxDist)
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

