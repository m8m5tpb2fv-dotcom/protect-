import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { APP } from "@/config/app";
import { db } from "@/server/db";
import { providers } from "@/server/db/schema";
import { getCatalog } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

/** SEO surface: home, catalogue (categories + specialities) and active provider profiles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  const provs = await db.select({ slug: providers.slug, at: providers.approvedAt }).from(providers).where(eq(providers.status, "active"));
  const u = (p: string) => `${APP.url}${p}`;
  return [
    { url: u("/"), changeFrequency: "daily", priority: 1 },
    { url: u("/services"), changeFrequency: "weekly", priority: 0.9 },
    ...catalog.categories.flatMap((c) => [{ url: u(`/services/${c.slug}`), changeFrequency: "daily" as const, priority: 0.8 }, ...c.subs.map((s) => ({ url: u(`/services/${s.slug}`), changeFrequency: "daily" as const, priority: 0.8 }))]),
    ...provs.map((p) => ({ url: u(`/provider/${p.slug}`), lastModified: p.at ?? undefined, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
