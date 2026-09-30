import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { providers, subcategories } from "@/server/db/schema";
import { api, query } from "@/server/http/handler";
import { getCatalog, getCurrentCity } from "@/server/services/catalog";
import { matchCatalog, tokenize } from "@/server/services/providers";

export const GET = api(
  async (req) => {
    const { q } = query(req, z.object({ q: z.string().trim().min(1).max(80) }));
    const [catalog, city, matched] = await Promise.all([getCatalog(), getCurrentCity(), matchCatalog(q)]);
    const tokens = tokenize(q);
    const provs = tokens.length
      ? await db
          .select({ slug: providers.slug, displayName: providers.displayName, subName: subcategories.name })
          .from(providers)
          .innerJoin(subcategories, eq(subcategories.id, providers.primarySubcategoryId))
          .where(and(eq(providers.status, "active"), eq(providers.cityId, city.id), sql`word_similarity(${q.toLowerCase()}, lower(${providers.displayName})) > 0.6`))
          .limit(3)
      : [];
    return {
      subs: matched.subs.map((s) => {
        const sub = catalog.subById.get(s.id)!;
        return { slug: s.slug, name: s.name, icon: sub.icon, categoryName: catalog.catById.get(sub.categoryId)?.name ?? "" };
      }),
      services: matched.services.slice(0, 5).map((v) => {
        const sub = catalog.subById.get(v.subcategoryId)!;
        return { slug: v.slug, name: v.name, subName: sub.name, icon: sub.icon, priceFrom: catalog.serviceById.get(v.id)?.priceFrom ?? null };
      }),
      providers: provs,
    };
  },
  { rate: { limit: 120, windowMs: 60_000, key: "suggest" } },
);
