import { cookies } from "next/headers";
import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { badRequest } from "@/server/http/errors";
import { CITY_COOKIE, getGeo } from "@/server/services/catalog";

export const GET = api(async () => {
  const geo = await getGeo();
  return { cities: geo.cities.map((c) => ({ slug: c.slug, name: c.name, region: c.region, isActive: c.isActive, districts: (geo.districtsByCity.get(c.id) ?? []).map((d) => ({ id: d.id, slug: d.slug, name: d.name, lat: d.lat, lng: d.lng })) })) };
});

export const POST = api(async (req) => {
  const { slug } = await body(req, z.object({ slug: z.string().max(40) }));
  const geo = await getGeo();
  const city = geo.cities.find((c) => c.slug === slug);
  if (!city || !city.isActive) throw badRequest("Этот город пока недоступен");
  (await cookies()).set(CITY_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true };
});
