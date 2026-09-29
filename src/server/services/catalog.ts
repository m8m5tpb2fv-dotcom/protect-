import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { APP } from "@/config/app";
import { db } from "../db";
import { categories, cities, districts, services, subcategories, type Category, type City, type District, type Service, type Subcategory } from "../db/schema";

export type Catalog = {
  categories: (Category & { subs: (Subcategory & { services: Service[] })[] })[];
  subBySlug: Map<string, Subcategory>;
  subById: Map<number, Subcategory>;
  catById: Map<number, Category>;
  catBySlug: Map<string, Category>;
  serviceById: Map<number, Service>;
};

let catalogCache: { at: number; value: Catalog } | null = null;
const TTL = 60_000;

export function invalidateCatalog() {
  catalogCache = null;
  geoCache = null;
}

export async function getCatalog(): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.at < TTL) return catalogCache.value;
  const [cats, subs, svcs] = await Promise.all([
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    db.select().from(subcategories).where(eq(subcategories.isActive, true)).orderBy(asc(subcategories.sortOrder)),
    db.select().from(services).orderBy(asc(services.sortOrder)),
  ]);
  const value: Catalog = {
    categories: cats.map((c) => ({
      ...c,
      subs: subs.filter((s) => s.categoryId === c.id).map((s) => ({ ...s, services: svcs.filter((v) => v.subcategoryId === s.id) })),
    })),
    subBySlug: new Map(subs.map((s) => [s.slug, s])),
    subById: new Map(subs.map((s) => [s.id, s])),
    catById: new Map(cats.map((c) => [c.id, c])),
    catBySlug: new Map(cats.map((c) => [c.slug, c])),
    serviceById: new Map(svcs.map((v) => [v.id, v])),
  };
  catalogCache = { at: Date.now(), value };
  return value;
}

type Geo = { cities: City[]; districtsByCity: Map<number, District[]>; districtById: Map<number, District> };
let geoCache: { at: number; value: Geo } | null = null;

export async function getGeo(): Promise<Geo> {
  if (geoCache && Date.now() - geoCache.at < TTL) return geoCache.value;
  const [cs, ds] = await Promise.all([db.select().from(cities).orderBy(asc(cities.sortOrder)), db.select().from(districts).orderBy(asc(districts.sortOrder))]);
  const districtsByCity = new Map<number, District[]>();
  for (const d of ds) districtsByCity.set(d.cityId, [...(districtsByCity.get(d.cityId) ?? []), d]);
  const value = { cities: cs, districtsByCity, districtById: new Map(ds.map((d) => [d.id, d])) };
  geoCache = { at: Date.now(), value };
  return value;
}

export const CITY_COOKIE = "ryadom_city";

/** City selected by the visitor (cookie), falling back to the default active city. */
export const getCurrentCity = cache(async (): Promise<City & { districts: District[] }> => {
  const geo = await getGeo();
  const slug = (await cookies()).get(CITY_COOKIE)?.value;
  const city = geo.cities.find((c) => c.slug === slug && c.isActive) ?? geo.cities.find((c) => c.slug === APP.defaultCitySlug) ?? geo.cities[0];
  if (!city) throw new Error("No cities in database. Run `npm run db:seed`.");
  return { ...city, districts: geo.districtsByCity.get(city.id) ?? [] };
});
