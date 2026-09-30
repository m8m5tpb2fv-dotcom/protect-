import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getCatalog, getCurrentCity } from "@/server/services/catalog";
import { getProviderCardsByIds, matchCatalog } from "@/server/services/providers";
import { db } from "@/server/db";
import { providerServices } from "@/server/db/schema";
import { OrderWizard, type WizardCatalog } from "./wizard";

export const metadata: Metadata = { title: "Новая заявка", robots: { index: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewOrderPage({ searchParams }: PageProps<"/order/new">) {
  const sp = await searchParams;
  const [user, city, catalog] = await Promise.all([getCurrentUser(), getCurrentCity(), getCatalog()]);
  const data: WizardCatalog = catalog.categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    tone: c.tone,
    subs: c.subs.map((s) => ({ id: s.id, slug: s.slug, name: s.name, icon: s.icon, keywords: s.keywords, services: s.services.map((v) => ({ id: v.id, slug: v.slug, name: v.name, priceFrom: v.priceFrom, unit: v.unit })) })),
  }));

  let subId: number | null = null;
  let serviceId: number | null = null;
  const serviceSlug = one(sp.service);
  const subSlug = one(sp.sub);
  const q = one(sp.q)?.slice(0, 120);
  if (serviceSlug) {
    const svc = [...catalog.serviceById.values()].find((v) => v.slug === serviceSlug);
    if (svc) {
      serviceId = svc.id;
      subId = svc.subcategoryId;
    }
  } else if (subSlug) subId = catalog.subBySlug.get(subSlug)?.id ?? null;
  else if (q) {
    const m = await matchCatalog(q);
    subId = m.services[0]?.subcategoryId ?? m.subs[0]?.id ?? null;
    if (m.services[0] && m.services[0].subcategoryId === subId) serviceId = m.services[0].id;
  }

  let provider = null;
  const providerId = one(sp.provider);
  if (providerId && /^[0-9a-f-]{36}$/.test(providerId)) {
    const [card] = await getProviderCardsByIds([providerId]);
    if (card) {
      const own = await db.select({ serviceId: providerServices.serviceId, title: providerServices.title, priceFrom: providerServices.priceFrom }).from(providerServices).where(eq(providerServices.providerId, card.id));
      provider = { id: card.id, slug: card.slug, displayName: card.displayName, avatarUrl: card.avatarUrl, subName: card.subName, ratingAvg: card.ratingAvg, reviewsCount: card.reviewsCount, prices: own };
      if (!subId) subId = catalog.subBySlug.get(card.subSlug)?.id ?? null;
    }
  }

  return (
    <OrderWizard
      catalog={data}
      districts={city.districts.map((d) => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng }))}
      cityName={city.name}
      isAuthed={!!user}
      userPhone={user?.phone ?? null}
      initial={{ subId, serviceId, q: q ?? "", urgency: one(sp.urgency) === "urgent" ? "urgent" : null, districtId: user?.districtId ?? null }}
      provider={provider}
      resume={one(sp.resume) === "1"}
    />
  );
}
