import type { MapMarker } from "./adapters";

/** Markers closer than this many screen pixels at the current zoom merge into one bubble. */
const CELL_PX = 64;
/** From this zoom on every marker is shown individually. */
export const CLUSTER_MAX_ZOOM = 16;

export const CLUSTER_PREFIX = "cluster:";

/**
 * Screen-space greedy clustering (Web Mercator approximation), provider-agnostic: a marker joins the
 * first group whose centre is closer than CELL_PX on screen, so bubbles never overlap at cell borders.
 * The user's own position and the active marker are never merged.
 */
export function clusterMarkers(markers: MapMarker[], zoom: number): MapMarker[] {
  if (zoom >= CLUSTER_MAX_ZOOM || markers.length < 2) return markers;
  const pxPerDeg = (256 * 2 ** zoom) / 360;
  const refLat = markers.reduce((a, m) => a + m.lat, 0) / markers.length;
  const latScale = 1 / Math.cos((refLat * Math.PI) / 180);
  const groups: { lat: number; lng: number; items: MapMarker[] }[] = [];
  const out: MapMarker[] = [];
  for (const m of markers) {
    if (m.kind === "me" || m.active) {
      out.push(m);
      continue;
    }
    const g = groups.find((g) => Math.hypot((g.lng - m.lng) * pxPerDeg, (g.lat - m.lat) * pxPerDeg * latScale) < CELL_PX);
    if (g) {
      g.items.push(m);
      g.lat += (m.lat - g.lat) / g.items.length;
      g.lng += (m.lng - g.lng) / g.items.length;
    } else groups.push({ lat: m.lat, lng: m.lng, items: [m] });
  }
  for (const { lat, lng, items } of groups) {
    if (items.length === 1) out.push(items[0]);
    else out.push({ id: `${CLUSTER_PREFIX}${lat.toFixed(5)}:${lng.toFixed(5)}`, lat, lng, label: String(items.length), title: `${items.length} исполнителей`, kind: "cluster" });
  }
  return out;
}

export function parseClusterId(id: string): [number, number] | null {
  if (!id.startsWith(CLUSTER_PREFIX)) return null;
  const [lat, lng] = id.slice(CLUSTER_PREFIX.length).split(":").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
