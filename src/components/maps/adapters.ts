"use client";
/**
 * Map provider abstraction. The app only talks to `MapAdapter`; concrete
 * providers (Leaflet/OSM, Yandex Maps v3, 2GIS MapGL) are loaded on demand.
 * Select with NEXT_PUBLIC_MAP_PROVIDER = leaflet | yandex | 2gis.
 */
export type MapMarker = { id: string; lat: number; lng: number; label?: string; title?: string; active?: boolean; kind?: "provider" | "order" | "me" };
export type MapCircle = { lat: number; lng: number; radiusKm: number };
export type MapOptions = { center: [number, number]; zoom: number; dark: boolean; onMarkerClick?: (id: string) => void };

export interface MapAdapter {
  setData(markers: MapMarker[], circles: MapCircle[]): void;
  setCenter(center: [number, number], zoom?: number): void;
  fitTo(markers: MapMarker[]): void;
  destroy(): void;
}

export type MapProviderId = "leaflet" | "yandex" | "2gis";
export const MAP_PROVIDER = (process.env.NEXT_PUBLIC_MAP_PROVIDER as MapProviderId) || "leaflet";

function markerHtml(m: MapMarker) {
  const bg = m.kind === "me" ? "var(--info)" : m.active ? "var(--accent)" : "var(--ink)";
  const fg = m.kind === "me" ? "#fff" : m.active ? "var(--accent-ink)" : "var(--bg)";
  if (m.kind === "me") return `<div style="width:18px;height:18px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 0 0 6px color-mix(in srgb, var(--info) 25%, transparent)"></div>`;
  const text = (m.label ?? "").replace(/[<>&"]/g, "");
  return `<div style="transform:translate(-50%,-100%);display:inline-flex;align-items:center;gap:4px;white-space:nowrap;height:30px;padding:0 11px;border-radius:999px;background:${bg};color:${fg};font:600 12.5px/1 Inter,system-ui;box-shadow:0 6px 16px -6px rgba(0,0,0,.45);border:2px solid var(--surface)">${text || "•"}</div>`;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("map script failed"));
    document.head.appendChild(s);
  });
}

/* ───────── Leaflet + OpenStreetMap tiles (no key) ───────── */
async function leaflet(el: HTMLElement, o: MapOptions): Promise<MapAdapter> {
  const L = (await import("leaflet")).default;
  await import("leaflet/dist/leaflet.css");
  const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView(o.center, o.zoom);
  // Leaflet's default prefix carries a flag icon; keep a plain text credit instead.
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.control.zoom({ position: "bottomright" }).addTo(map);
  // Dark theme = the same tiles through a CSS filter (see .map-dark in globals.css).
  el.classList.toggle("map-dark", o.dark);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  return {
    setData(markers, circles) {
      layer.clearLayers();
      for (const c of circles) L.circle([c.lat, c.lng], { radius: c.radiusKm * 1000, color: "#0d0d0f", weight: 1, opacity: 0.25, fillColor: "#d4f25c", fillOpacity: 0.18 }).addTo(layer);
      for (const m of markers) {
        const mk = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: "ryadom-pin", html: markerHtml(m), iconSize: [0, 0] }), title: m.title, zIndexOffset: m.active ? 1000 : 0, keyboard: true });
        if (o.onMarkerClick && m.kind !== "me") mk.on("click", () => o.onMarkerClick!(m.id));
        mk.addTo(layer);
      }
    },
    setCenter(c, z) {
      map.setView(c, z ?? map.getZoom());
    },
    fitTo(markers) {
      if (markers.length > 1) map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    },
    destroy() {
      map.remove();
    },
  };
}

/* ───────── Yandex Maps JS API v3 ───────── */
type Y = {
  ready: Promise<void>;
  YMap: new (el: HTMLElement, opts: unknown) => { addChild(c: unknown): void; removeChild(c: unknown): void; update(o: unknown): void; destroy(): void };
  YMapDefaultSchemeLayer: new (o?: unknown) => unknown;
  YMapDefaultFeaturesLayer: new (o?: unknown) => unknown;
  YMapMarker: new (o: unknown, el: HTMLElement) => unknown;
};
async function yandex(el: HTMLElement, o: MapOptions): Promise<MapAdapter> {
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_YANDEX_MAPS_API_KEY is not set");
  // Never hang on a bad key / blocked script: give up after 8 s and let createMap fall back to Leaflet.
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("yandex maps timeout")), 8000));
  await Promise.race([loadScript(`https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`), timeout]);
  const ymaps3 = (window as unknown as { ymaps3?: Y }).ymaps3;
  if (!ymaps3) throw new Error("ymaps3 unavailable");
  await Promise.race([ymaps3.ready, timeout]);
  const map = new ymaps3.YMap(el, { location: { center: [o.center[1], o.center[0]], zoom: o.zoom }, theme: o.dark ? "dark" : "light" });
  map.addChild(new ymaps3.YMapDefaultSchemeLayer({}));
  map.addChild(new ymaps3.YMapDefaultFeaturesLayer({}));
  let children: unknown[] = [];
  return {
    setData(markers) {
      children.forEach((c) => map.removeChild(c));
      children = markers.map((m) => {
        const node = document.createElement("div");
        node.innerHTML = markerHtml(m);
        if (o.onMarkerClick && m.kind !== "me") node.onclick = () => o.onMarkerClick!(m.id);
        const mk = new ymaps3.YMapMarker({ coordinates: [m.lng, m.lat] }, node);
        map.addChild(mk);
        return mk;
      });
    },
    setCenter(c, z) {
      map.update({ location: { center: [c[1], c[0]], zoom: z ?? o.zoom, duration: 300 } });
    },
    fitTo(markers) {
      if (markers.length < 2) return;
      const lngs = markers.map((m) => m.lng);
      const lats = markers.map((m) => m.lat);
      const pad = 0.01;
      map.update({ location: { bounds: [[Math.min(...lngs) - pad, Math.min(...lats) - pad], [Math.max(...lngs) + pad, Math.max(...lats) + pad]], duration: 300 } });
    },
    destroy() {
      map.destroy();
    },
  };
}

/* ───────── 2GIS MapGL ───────── */
type G = { Map: new (el: HTMLElement, o: unknown) => { setCenter(c: number[]): void; setZoom(z: number): void; destroy(): void }; HtmlMarker: new (map: unknown, o: unknown) => { destroy(): void } };
async function dgis(el: HTMLElement, o: MapOptions): Promise<MapAdapter> {
  const key = process.env.NEXT_PUBLIC_2GIS_API_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_2GIS_API_KEY is not set");
  await loadScript("https://mapgl.2gis.com/api/js/v1");
  const mapgl = (window as unknown as { mapgl: G }).mapgl;
  const map = new mapgl.Map(el, { center: [o.center[1], o.center[0]], zoom: o.zoom, key });
  let ms: { destroy(): void }[] = [];
  return {
    setData(markers) {
      ms.forEach((m) => m.destroy());
      ms = markers.map((m) => new mapgl.HtmlMarker(map, { coordinates: [m.lng, m.lat], html: markerHtml(m) }));
    },
    setCenter(c, z) {
      map.setCenter([c[1], c[0]]);
      if (z) map.setZoom(z);
    },
    fitTo() {},
    destroy() {
      map.destroy();
    },
  };
}

/** Why the configured provider was not used (shown with ?mapdebug=1). */
export type MapDiagnostics = { requested: MapProviderId; used: MapProviderId; reason: string | null };
export let lastMapDiagnostics: MapDiagnostics | null = null;

export async function createMap(el: HTMLElement, o: MapOptions, provider: MapProviderId = MAP_PROVIDER): Promise<MapAdapter> {
  // collect CSP blocks of the provider's resources — the most common silent failure
  const blocked: string[] = [];
  const onCsp = (e: SecurityPolicyViolationEvent) => blocked.push(`${e.effectiveDirective} ${e.blockedURI}`);
  document.addEventListener("securitypolicyviolation", onCsp);
  try {
    if (provider === "yandex") return await withDiag(provider, yandex(el, o));
    if (provider === "2gis") return await withDiag(provider, dgis(el, o));
  } catch (e) {
    console.warn("[map] provider failed, falling back to leaflet", e, blocked);
    lastMapDiagnostics = { requested: provider, used: "leaflet", reason: [e instanceof Error ? e.message : String(e), ...blocked.slice(0, 3)].join(" · ") };
  } finally {
    document.removeEventListener("securitypolicyviolation", onCsp);
  }
  if (provider === "leaflet") lastMapDiagnostics = { requested: provider, used: "leaflet", reason: null };
  return leaflet(el, o);
}

async function withDiag(provider: MapProviderId, p: Promise<MapAdapter>) {
  const a = await p;
  lastMapDiagnostics = { requested: provider, used: provider, reason: null };
  return a;
}
