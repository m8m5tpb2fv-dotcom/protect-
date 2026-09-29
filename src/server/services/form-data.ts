import "server-only";
import { getCatalog, getCurrentCity } from "./catalog";

/** Compact catalogue + districts for provider forms. */
export async function providerFormData() {
  const [catalog, city] = await Promise.all([getCatalog(), getCurrentCity()]);
  return {
    catalog: catalog.categories.map((c) => ({ id: c.id, name: c.name, subs: c.subs.map((s) => ({ id: s.id, name: s.name, icon: s.icon })) })),
    districts: city.districts.map((d) => ({ id: d.id, name: d.name })),
  };
}
