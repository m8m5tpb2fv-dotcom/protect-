import type { Metadata } from "next";
import { requireProvider } from "@/server/auth/session";
import { getOwnProvider } from "@/server/services/provider-self";
import { getCatalog } from "@/server/services/catalog";
import { ServicesEditor } from "./editor";

export const metadata: Metadata = { title: "Услуги и цены", robots: { index: false } };

export default async function ProServicesPage() {
  const user = await requireProvider();
  const own = (await getOwnProvider(user))!;
  const catalog = await getCatalog();
  const suggestions = own.subcategoryIds.flatMap((id) => catalog.categories.flatMap((c) => c.subs.filter((s) => s.id === id).flatMap((s) => s.services))).filter((s) => !own.services.some((x) => x.serviceId === s.id));
  return <ServicesEditor initial={own.services} suggestions={suggestions.map((s) => ({ id: s.id, name: s.name, priceFrom: s.priceFrom, unit: s.unit }))} />;
}
