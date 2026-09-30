import "server-only";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { ads, type Ad } from "../db/schema";
import { channelOn } from "../billing";

export type AdSlot = Ad["slot"];
export type PublicAd = Pick<Ad, "id" | "title" | "body" | "advertiser" | "erid">;

/** One live ad for a slot (random among eligible), or null when the "ads" channel is off. Counts an impression. */
export async function pickAd(slot: AdSlot, categoryId?: number): Promise<PublicAd | null> {
  if (!channelOn("ads")) return null;
  const now = new Date();
  const [ad] = await db
    .select({ id: ads.id, title: ads.title, body: ads.body, advertiser: ads.advertiser, erid: ads.erid })
    .from(ads)
    .where(
      and(
        eq(ads.slot, slot),
        eq(ads.isActive, true),
        lte(ads.startsAt, now),
        gt(ads.endsAt, now),
        categoryId != null ? or(isNull(ads.categoryId), eq(ads.categoryId, categoryId)) : isNull(ads.categoryId),
      ),
    )
    .orderBy(sql`random()`)
    .limit(1);
  if (!ad) return null;
  await db.update(ads).set({ impressions: sql`${ads.impressions} + 1` }).where(eq(ads.id, ad.id));
  return ad;
}

/** Resolves the click-through URL (optionally counting the click). Only http(s) targets are ever returned. */
export async function adClick(id: string, count = true): Promise<string | null> {
  const [ad] = count
    ? await db.update(ads).set({ clicks: sql`${ads.clicks} + 1` }).where(eq(ads.id, id)).returning({ url: ads.linkUrl })
    : await db.select({ url: ads.linkUrl }).from(ads).where(eq(ads.id, id));
  if (!ad) return null;
  try {
    const u = new URL(ad.url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
