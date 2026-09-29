import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { ProviderProfileInput } from "@/lib/validation";
import { slugify } from "@/lib/slug";
import { db } from "../db";
import { portfolioItems, providerDistricts, providerDocuments, providers, providerServices, providerSubcategories, users, type WeeklySchedule } from "../db/schema";
import type { CurrentUser } from "../auth/session";
import { badRequest, forbidden, notFound } from "../http/errors";
import { notify } from "../notifications/notify";
import { getCatalog, getGeo } from "./catalog";
import { rebuildSearchText } from "./provider-stats";
import { normalizePhone } from "@/lib/phone";

async function uniqueSlug(base: string) {
  const root = slugify(base) || "master";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [taken] = await db.select({ id: providers.id }).from(providers).where(eq(providers.slug, candidate));
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const DEFAULT_SCHEDULE: WeeklySchedule = {
  mon: { from: "09:00", to: "19:00" },
  tue: { from: "09:00", to: "19:00" },
  wed: { from: "09:00", to: "19:00" },
  thu: { from: "09:00", to: "19:00" },
  fri: { from: "09:00", to: "19:00" },
  sat: { from: "10:00", to: "16:00" },
  sun: null,
};

async function validateRefs(input: ProviderProfileInput, cityId: number) {
  const catalog = await getCatalog();
  if (!catalog.subById.has(input.primarySubcategoryId)) throw badRequest("Выберите специализацию");
  for (const id of input.subcategoryIds) if (!catalog.subById.has(id)) throw badRequest("Неизвестная специализация");
  const geo = await getGeo();
  const district = input.districtId ? geo.districtById.get(input.districtId) : null;
  if (input.districtId && (!district || district.cityId !== cityId)) throw badRequest("Район не найден");
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) throw badRequest("Проверьте номер телефона");
  }
  return { district, phone };
}

/** «Стать исполнителем»: creates a draft profile and submits it for moderation. */
export async function createProviderProfile(user: CurrentUser, input: ProviderProfileInput, cityId: number) {
  if (user.provider) throw badRequest("Профиль исполнителя уже создан");
  const { district, phone } = await validateRefs(input, cityId);
  const slug = await uniqueSlug(input.displayName);
  const p = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(providers)
      .values({
        userId: user.id,
        slug,
        displayName: input.displayName,
        kind: input.kind,
        headline: input.headline,
        bio: input.bio,
        primarySubcategoryId: input.primarySubcategoryId,
        cityId,
        districtId: district?.id ?? null,
        lat: district?.lat ?? null,
        lng: district?.lng ?? null,
        radiusKm: input.radiusKm,
        worksCityWide: input.worksCityWide,
        experienceYears: input.experienceYears,
        priceFrom: input.priceFrom ?? null,
        phone,
        telegram: input.telegram ? input.telegram.replace(/^@?/, "@") : null,
        showPhone: input.showPhone,
        avatarUrl: input.avatarUrl ?? null,
        coverUrl: input.coverUrl ?? null,
        schedule: input.schedule ?? DEFAULT_SCHEDULE,
        status: "pending",
      })
      .returning();
    const subIds = [...new Set([input.primarySubcategoryId, ...input.subcategoryIds])];
    await tx.insert(providerSubcategories).values(subIds.map((subcategoryId) => ({ providerId: row.id, subcategoryId })));
    if (district) await tx.insert(providerDistricts).values({ providerId: row.id, districtId: district.id });
    if (phone && !user.phone) await tx.update(users).set({ phone }).where(and(eq(users.id, user.id), sql`not exists (select 1 from users u2 where u2.phone = ${phone})`));
    if (input.avatarUrl) await tx.update(users).set({ avatarUrl: input.avatarUrl }).where(eq(users.id, user.id));
    return row;
  });
  await rebuildSearchText(db, p.id);
  await notify(user.id, { type: "provider.moderation", title: "Профиль отправлен на проверку", body: "Обычно проверка занимает до 24 часов. Пока можно добавить услуги и работы в портфолио.", link: "/pro" });
  return p;
}

export async function updateProviderProfile(user: CurrentUser, input: ProviderProfileInput) {
  if (!user.provider) throw forbidden();
  const [current] = await db.select().from(providers).where(eq(providers.id, user.provider.id));
  const { district, phone } = await validateRefs(input, current.cityId);
  // changing the main speciality or name of an approved profile sends it back to moderation
  const needsReview = current.status === "active" && (current.primarySubcategoryId !== input.primarySubcategoryId || current.displayName !== input.displayName);
  await db.transaction(async (tx) => {
    await tx
      .update(providers)
      .set({
        displayName: input.displayName,
        kind: input.kind,
        headline: input.headline,
        bio: input.bio,
        primarySubcategoryId: input.primarySubcategoryId,
        districtId: district?.id ?? null,
        lat: district?.lat ?? current.lat,
        lng: district?.lng ?? current.lng,
        radiusKm: input.radiusKm,
        worksCityWide: input.worksCityWide,
        experienceYears: input.experienceYears,
        priceFrom: input.priceFrom ?? null,
        phone,
        telegram: input.telegram ? input.telegram.replace(/^@?/, "@") : null,
        showPhone: input.showPhone,
        avatarUrl: input.avatarUrl ?? null,
        coverUrl: input.coverUrl ?? null,
        schedule: input.schedule ?? current.schedule,
        ...(needsReview ? { status: "pending" as const } : current.status === "rejected" ? { status: "pending" as const, moderationNote: null } : {}),
      })
      .where(eq(providers.id, current.id));
    await tx.delete(providerSubcategories).where(eq(providerSubcategories.providerId, current.id));
    const subIds = [...new Set([input.primarySubcategoryId, ...input.subcategoryIds])];
    await tx.insert(providerSubcategories).values(subIds.map((subcategoryId) => ({ providerId: current.id, subcategoryId })));
    await tx.delete(providerDistricts).where(eq(providerDistricts.providerId, current.id));
    if (district) await tx.insert(providerDistricts).values({ providerId: current.id, districtId: district.id });
  });
  await rebuildSearchText(db, current.id);
  return { needsReview };
}

export async function setAvailability(user: CurrentUser, isAvailable: boolean) {
  if (!user.provider) throw forbidden();
  await db.update(providers).set({ isAvailable }).where(eq(providers.id, user.provider.id));
}

export async function getOwnProvider(user: CurrentUser) {
  if (!user.provider) return null;
  const [p] = await db.select().from(providers).where(eq(providers.id, user.provider.id));
  const [svcs, portfolio, subs, docs] = await Promise.all([
    db.select().from(providerServices).where(eq(providerServices.providerId, p.id)).orderBy(asc(providerServices.sortOrder)),
    db.select().from(portfolioItems).where(eq(portfolioItems.providerId, p.id)).orderBy(asc(portfolioItems.sortOrder)),
    db.select().from(providerSubcategories).where(eq(providerSubcategories.providerId, p.id)),
    db.select({ id: providerDocuments.id, kind: providerDocuments.kind, status: providerDocuments.status, createdAt: providerDocuments.createdAt }).from(providerDocuments).where(eq(providerDocuments.providerId, p.id)),
  ]);
  return { provider: p, services: svcs, portfolio, subcategoryIds: subs.map((s) => s.subcategoryId), documents: docs };
}

export async function addService(user: CurrentUser, input: { title: string; description: string; priceFrom: number; priceTo?: number | null; unit: string; serviceId?: number | null }) {
  if (!user.provider) throw forbidden();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(providerServices).where(eq(providerServices.providerId, user.provider.id));
  if (n >= 40) throw badRequest("Максимум 40 услуг");
  if (input.priceTo != null && input.priceTo < input.priceFrom) throw badRequest("Цена «до» меньше цены «от»");
  const [row] = await db.insert(providerServices).values({ providerId: user.provider.id, ...input, sortOrder: n }).returning();
  await syncPriceFrom(user.provider.id);
  await rebuildSearchText(db, user.provider.id);
  return row;
}

export async function updateService(user: CurrentUser, id: string, input: { title: string; description: string; priceFrom: number; priceTo?: number | null; unit: string }) {
  if (!user.provider) throw forbidden();
  const res = await db.update(providerServices).set(input).where(and(eq(providerServices.id, id), eq(providerServices.providerId, user.provider.id))).returning();
  if (!res.length) throw notFound();
  await syncPriceFrom(user.provider.id);
  await rebuildSearchText(db, user.provider.id);
  return res[0];
}

export async function deleteService(user: CurrentUser, id: string) {
  if (!user.provider) throw forbidden();
  await db.delete(providerServices).where(and(eq(providerServices.id, id), eq(providerServices.providerId, user.provider.id)));
  await syncPriceFrom(user.provider.id);
  await rebuildSearchText(db, user.provider.id);
}

async function syncPriceFrom(providerId: string) {
  await db.execute(sql`update providers set price_from = coalesce((select min(price_from) from provider_services where provider_id = ${providerId}), price_from) where id = ${providerId}`);
}

export async function addPortfolio(user: CurrentUser, input: { url: string; width: number; height: number; caption: string }) {
  if (!user.provider) throw forbidden();
  if (!input.url.startsWith("/files/portfolio/")) throw badRequest("Загрузите файл через форму портфолио");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portfolioItems).where(eq(portfolioItems.providerId, user.provider.id));
  if (n >= 60) throw badRequest("Максимум 60 работ в портфолио");
  const kind = /\.(mp4|webm)$/.test(input.url) ? "video" : "image";
  const [row] = await db.insert(portfolioItems).values({ providerId: user.provider.id, kind, url: input.url, width: input.width, height: input.height, caption: input.caption, sortOrder: -Date.now() % 1_000_000 }).returning();
  return row;
}

export async function deletePortfolio(user: CurrentUser, id: string) {
  if (!user.provider) throw forbidden();
  await db.delete(portfolioItems).where(and(eq(portfolioItems.id, id), eq(portfolioItems.providerId, user.provider.id)));
}

export async function addDocument(user: CurrentUser, kind: string, url: string) {
  if (!user.provider) throw forbidden();
  if (!url.startsWith("/files/private/document/")) throw badRequest("Загрузите документ через форму");
  const [row] = await db.insert(providerDocuments).values({ providerId: user.provider.id, kind, fileKey: url.slice(7) }).returning({ id: providerDocuments.id });
  return row;
}
