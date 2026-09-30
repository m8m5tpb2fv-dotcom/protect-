import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../db";
import { orders, orderResponses, orderEvents, providers, providerServices, providerSubcategories, reviews, subcategories } from "../db/schema";

/** Normalised text used for trigram search. */
export async function rebuildSearchText(db: DbOrTx, providerId: string) {
  const [p] = await db.select().from(providers).where(eq(providers.id, providerId));
  if (!p) return;
  const subs = await db
    .select({ name: subcategories.name, plural: subcategories.namePlural, keywords: subcategories.keywords })
    .from(providerSubcategories)
    .innerJoin(subcategories, eq(subcategories.id, providerSubcategories.subcategoryId))
    .where(eq(providerSubcategories.providerId, providerId));
  const svcs = await db.select({ title: providerServices.title }).from(providerServices).where(eq(providerServices.providerId, providerId));
  const text = [p.displayName, p.headline, ...subs.flatMap((s) => [s.name, s.plural, s.keywords]), ...svcs.map((s) => s.title)]
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
  await db.update(providers).set({ searchText: text }).where(eq(providers.id, providerId));
}

/** Recompute rating, reviews count, repeat-client share and average first-response time. */
export async function recomputeProviderStats(db: DbOrTx, providerId: string) {
  const [r] = await db
    .select({ avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.providerId, providerId), eq(reviews.status, "visible")));

  const [clients] = await db
    .select({
      clients: sql<number>`count(distinct ${orders.clientId})::int`,
      repeat: sql<number>`count(*) filter (where cnt > 1)::int`,
    })
    .from(
      db
        .select({ clientId: orders.clientId, cnt: sql<number>`count(*)`.as("cnt") })
        .from(orders)
        .where(and(eq(orders.providerId, providerId), eq(orders.status, "completed")))
        .groupBy(orders.clientId)
        .as("c"),
    );

  // First response time: order created → provider's response created (minutes, median-ish via avg of capped values)
  const [rt] = await db
    .select({ minutes: sql<number | null>`avg(least(extract(epoch from (${orderResponses.createdAt} - ${orders.createdAt})) / 60, 240))::int` })
    .from(orderResponses)
    .innerJoin(orders, eq(orders.id, orderResponses.orderId))
    .where(eq(orderResponses.providerId, providerId));

  const update: Partial<typeof providers.$inferInsert> = {
    ratingAvg: Math.round((r?.avg ?? 0) * 100) / 100,
    reviewsCount: r?.count ?? 0,
  };
  if (clients && clients.clients >= 10) {
    update.repeatClientsPct = Math.round((clients.repeat / clients.clients) * 100);
  }
  if (rt?.minutes != null) update.responseTimeMin = Math.max(1, rt.minutes);
  await db.update(providers).set(update).where(eq(providers.id, providerId));
}

export async function logOrderEvent(db: DbOrTx, orderId: string, actorId: string | null, type: string, data?: Record<string, unknown>) {
  await db.insert(orderEvents).values({ orderId, actorId, type, data });
}
