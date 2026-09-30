/**
 * Yandex Geosuggest + HTTP Geocoder, called from the browser.
 * Keys are public by design and protected by HTTP Referer restrictions in the Yandex developer console.
 *  - NEXT_PUBLIC_YANDEX_SUGGEST_API_KEY — «API Геосаджеста» (address suggestions while typing)
 *  - NEXT_PUBLIC_YANDEX_MAPS_API_KEY    — «JavaScript API и HTTP Геокодер» (coordinates ↔ address)
 * Without keys every function resolves to an empty result and the form works as a plain text field.
 */

const SUGGEST_KEY = process.env.NEXT_PUBLIC_YANDEX_SUGGEST_API_KEY || "";
const GEOCODER_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

export const addressSuggestEnabled = () => !!SUGGEST_KEY;

export type AddressSuggestion = { title: string; subtitle: string; uri: string | null; formatted: string };
export type GeoPoint = { lat: number; lng: number };
export type GeocodeResult = GeoPoint & { street: string };

type SuggestResponse = { results?: { title?: { text?: string }; subtitle?: { text?: string }; uri?: string; address?: { formatted_address?: string } }[] };
type GeocoderResponse = {
  response?: {
    GeoObjectCollection?: {
      featureMember?: {
        GeoObject?: {
          Point?: { pos?: string };
          metaDataProperty?: { GeocoderMetaData?: { text?: string; Address?: { Components?: { kind: string; name: string }[] } } };
        };
      }[];
    };
  };
};

export function parseSuggest(json: SuggestResponse): AddressSuggestion[] {
  return (json.results ?? [])
    .filter((r) => r.title?.text)
    .map((r) => ({ title: r.title!.text!, subtitle: r.subtitle?.text ?? "", uri: r.uri ?? null, formatted: r.address?.formatted_address ?? r.title!.text! }));
}

/** First geocoder hit → coordinates + short street address («улица Чапаева, 10», without country/city). */
export function parseGeocode(json: GeocoderResponse): GeocodeResult | null {
  const obj = json.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = obj?.Point?.pos?.split(" ").map(Number);
  if (!obj || !pos || pos.length !== 2 || pos.some((n) => !Number.isFinite(n))) return null;
  const meta = obj.metaDataProperty?.GeocoderMetaData;
  const parts = (meta?.Address?.Components ?? []).filter((c) => ["district", "street", "house"].includes(c.kind));
  // prefer street + house; fall back to the last meaningful component of the full text
  const streetParts = parts.filter((c) => c.kind !== "district").map((c) => c.name);
  const street = streetParts.length ? streetParts.join(", ") : (meta?.text ?? "").split(", ").slice(-2).join(", ");
  return { lng: pos[0], lat: pos[1], street };
}

/** Suggestions around the city centre (strict to ~40 km so other Saratovs/streets don't show up). */
export async function suggestAddress(text: string, center: GeoPoint, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  if (!SUGGEST_KEY || text.trim().length < 3) return [];
  const qs = new URLSearchParams({
    apikey: SUGGEST_KEY,
    text,
    lang: "ru_RU",
    ll: `${center.lng},${center.lat}`,
    spn: "0.6,0.4",
    strict_bounds: "1",
    types: "street,house",
    print_address: "1",
    attrs: "uri",
    results: "6",
  });
  const res = await fetch(`https://suggest-maps.yandex.ru/v1/suggest?${qs}`, { signal });
  if (!res.ok) return [];
  return parseSuggest((await res.json()) as SuggestResponse);
}

async function geocoder(params: Record<string, string>): Promise<GeocodeResult | null> {
  if (!GEOCODER_KEY) return null;
  const qs = new URLSearchParams({ apikey: GEOCODER_KEY, format: "json", lang: "ru_RU", results: "1", ...params });
  const res = await fetch(`https://geocode-maps.yandex.ru/1.x/?${qs}`);
  if (!res.ok) return null;
  return parseGeocode((await res.json()) as GeocoderResponse);
}

/** Coordinates for a chosen suggestion (by its uri, or by the formatted address). */
export function geocodeSuggestion(s: AddressSuggestion) {
  return s.uri ? geocoder({ uri: s.uri }) : geocoder({ geocode: s.formatted });
}

/** Address for a point (used after «Использовать моё местоположение»). */
export function reverseGeocode(p: GeoPoint) {
  return geocoder({ geocode: `${p.lng},${p.lat}`, kind: "house" });
}
