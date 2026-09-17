export type GeoPoint = {
  lat: number;
  lng: number;
};

export type GeoBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const METERS_PER_DEGREE_LAT = 111320;

export function metersToLatDegrees(meters: number) {
  return meters / METERS_PER_DEGREE_LAT;
}

export function metersToLngDegrees(meters: number, lat: number) {
  const denom = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  if (!denom) return 0;
  return meters / denom;
}

export function boundsFromCenter(center: GeoPoint, radiusMeters: number): GeoBounds {
  const latOffset = metersToLatDegrees(radiusMeters);
  const lngOffset = metersToLngDegrees(radiusMeters, center.lat);
  return {
    north: center.lat + latOffset,
    south: center.lat - latOffset,
    east: center.lng + lngOffset,
    west: center.lng - lngOffset
  };
}

export function calculateCellCenter(bounds: GeoBounds): GeoPoint {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };
}

export function getDistanceMeters(a: GeoPoint, b: GeoPoint) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * Math.PI / 180) *
    Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}
