import "server-only";
import { and, eq, ilike, inArray, isNotNull, like, sql } from "drizzle-orm";
import { db } from "../db";
import { ads, orders, promoCodes, providers, reviews, supportTickets, users } from "../db/schema";
import { conflict } from "../http/errors";
import { recomputeProviderStats } from "./provider-stats";

/*
 * Demo data (scripts/seed.ts --demo / DEMO_MODE=true) is marked by construction:
 *  - every demo account has an e-mail on the reserved domain below;
 *  - demo ads carry an erid starting with "DEMO";
 *  - demo promo codes are the two fixed codes from the seed.
 * Everything else hangs off demo accounts and goes with them (FK cascades).
 */
const DEMO_EMAIL = "%@demo.ryadom.local";
const DEMO_PROMO_CODES = ["WELCOME10", "PRO50"];
const ACTIVE = ["new", "responses", "assigned", "in_progress"] as const;

export async function demoSummary() {
  const [[u], [p], [a]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(ilike(users.email, DEMO_EMAIL)),
    db.select({ n: sql<number>`count(*)::int` }).from(providers).innerJoin(users, eq(users.id, providers.userId)).where(ilike(users.email, DEMO_EMAIL)),
    db.select({ n: sql<number>`count(*)::int` }).from(ads).where(like(ads.erid, "DEMO%")),
  ]);
  return { users: u.n, providers: p.n, ads: a.n, reseeds: process.env.DEMO_MODE === "true" };
}

/**
 * Removes all demo data in one transaction. Real accounts stay; a real client's active order that had a
 * demo provider chosen is cancelled, and the stats of real providers are recomputed (demo reviews go away).
 */
export async function purgeDemo() {
  // with DEMO_MODE on, the next start would seed everything again
  if (process.env.DEMO_MODE === "true") throw conflict("Сначала удалите переменную DEMO_MODE в Railway — иначе демо-данные вернутся после перезапуска");
  return db.transaction(async (tx) => {
    const demoUsers = (await tx.select({ id: users.id }).from(users).where(ilike(users.email, DEMO_EMAIL))).map((r) => r.id);
    const demoProviders = demoUsers.length ? (await tx.select({ id: providers.id }).from(providers).where(inArray(providers.userId, demoUsers))).map((r) => r.id) : [];

    let cancelledOrders = 0;
    if (demoProviders.length) {
      const cancelled = await tx
        .update(orders)
        .set({ status: "cancelled" })
        .where(and(inArray(orders.providerId, demoProviders), inArray(orders.status, [...ACTIVE]), sql`${orders.clientId} not in (select id from ${users} where ${users.email} ilike ${DEMO_EMAIL})`))
        .returning({ id: orders.id });
      cancelledOrders = cancelled.length;
    }
    // real providers whose stats include reviews or orders of demo clients
    const touched = new Set<string>();
    if (demoUsers.length) {
      for (const r of await tx.selectDistinct({ id: reviews.providerId }).from(reviews).where(inArray(reviews.authorId, demoUsers))) touched.add(r.id);
      for (const r of await tx.selectDistinct({ id: orders.providerId }).from(orders).where(and(inArray(orders.clientId, demoUsers), isNotNull(orders.providerId)))) if (r.id) touched.add(r.id);
    }
    for (const id of demoProviders) touched.delete(id);

    if (demoUsers.length) await tx.delete(supportTickets).where(inArray(supportTickets.userId, demoUsers));
    const deletedUsers = demoUsers.length ? (await tx.delete(users).where(inArray(users.id, demoUsers)).returning({ id: users.id })).length : 0;
    // reports about things that no longer exist
    await tx.execute(sql`
      delete from reports r where
        (r.target_type = 'provider' and not exists (select 1 from providers p where p.id::text = r.target_id::text)) or
        (r.target_type = 'review' and not exists (select 1 from reviews v where v.id::text = r.target_id::text)) or
        (r.target_type = 'order' and not exists (select 1 from orders o where o.id::text = r.target_id::text)) or
        (r.target_type = 'user' and not exists (select 1 from users u where u.id::text = r.target_id::text))`);
    const deletedAds = (await tx.delete(ads).where(like(ads.erid, "DEMO%")).returning({ id: ads.id })).length;
    await tx.delete(promoCodes).where(and(inArray(promoCodes.code, DEMO_PROMO_CODES), eq(promoCodes.usedCount, 0)));
    for (const id of touched) await recomputeProviderStats(tx, id);
    return { users: deletedUsers, providers: demoProviders.length, ads: deletedAds, cancelledOrders, recomputed: touched.size };
  });
}
