export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** An order point further than this from its city centre is a stray GPS fix (e.g. the client is travelling). */
export const MAX_ORDER_KM_FROM_CITY = 60;

/**
 * Coordinates to store for an order: the client's point if it lies within the order's city,
 * otherwise the centre of the chosen district (or none).
 */
export function orderPoint(point: Partial<LatLng> | null, city: LatLng | undefined, district: LatLng | undefined): LatLng | null {
  const p = point?.lat != null && point.lng != null ? { lat: point.lat, lng: point.lng } : null;
  if (p && (!city || haversineKm(p, city) <= MAX_ORDER_KM_FROM_CITY)) return p;
  return district ? { lat: district.lat, lng: district.lng } : null;
}
