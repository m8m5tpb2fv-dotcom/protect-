import "server-only";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  categories, districts, favorites, portfolioItems, providerDistricts, providers, providerServices, providerSubcategories, reviews, subcategories, users,
} from "../db/schema";
import { getCatalog } from "./catalog";
import type { SearchQuery } from "@/lib/validation";
import { channelOn, perks } from "../billing";

export type ProviderCard = {
  id: string;
  slug: string;
  displayName: string;
  kind: string;
  headline: string;
  subName: string;
  subSlug: string;
  icon: string;
  tone: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  ratingAvg: number;
  reviewsCount: number;
  ordersCompleted: number;
  responseTimeMin: number | null;
  priceFrom: number | null;
  isAvailable: boolean;
  verification: "none" | "verified" | "pro" | "business";
  isPro: boolean;
  isPromoted: boolean;
  isHighlighted: boolean;
  districtName: string | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  worksCityWide: boolean;
  distanceKm: number | null;
  experienceYears: number;
};

/** Haversine distance in km as SQL expression. */
function distanceExpr(lat: number, lng: number) {
  return sql<number>`(6371 * 2 * asin(sqrt(power(sin(radians(${providers.lat} - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(${providers.lat})) * power(sin(radians(${providers.lng} - ${lng}) / 2), 2))))`;
}

const cardColumns = (dist: SQL<number> | null) => ({
  id: providers.id,
  slug: providers.slug,
  displayName: providers.displayName,
  kind: providers.kind,
  headline: providers.headline,
  subName: subcategories.name,
  subSlug: subcategories.slug,
  icon: subcategories.icon,
  tone: categories.tone,
  avatarUrl: providers.avatarUrl,
  coverUrl: providers.coverUrl,
  ratingAvg: providers.ratingAvg,
  reviewsCount: providers.reviewsCount,
  ordersCompleted: providers.ordersCompleted,
  responseTimeMin: providers.responseTimeMin,
  priceFrom: providers.priceFrom,
  isAvailable: providers.isAvailable,
  verification: providers.verification,
  proUntil: providers.proUntil,
  boostedUntil: providers.boostedUntil,
  highlightedUntil: providers.highlightedUntil,
  districtName: districts.name,
  lat: providers.lat,
  lng: providers.lng,
  radiusKm: providers.radiusKm,
  worksCityWide: providers.worksCityWide,
  experienceYears: providers.experienceYears,
  distanceKm: dist ?? sql<number | null>`null::float`,
});

type CardRow = Omit<ProviderCard, "isPro" | "isPromoted" | "isHighlighted"> & { proUntil: Date | null; boostedUntil: Date | null; highlightedUntil: Date | null };

function toCard(r: CardRow): ProviderCard {
  const { proUntil, boostedUntil, highlightedUntil, ...rest } = r;
  const perk = perks({ proUntil, boostedUntil, highlightedUntil });
  return {
    ...rest,
    distanceKm: r.distanceKm == null ? null : Math.round(r.distanceKm * 10) / 10,
    isPro: perk.pro,
    isPromoted: perk.boosted,
    isHighlighted: perk.highlighted,
  };
}

function baseCardQuery(dist: SQL<number> | null) {
  return db
    .select(cardColumns(dist))
    .from(providers)
    .innerJoin(subcategories, eq(subcategories.id, providers.primarySubcategoryId))
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .leftJoin(districts, eq(districts.id, providers.districtId));
}

/** Bayesian-smoothed rating so 5.0 with 1 review doesn't beat 4.9 with 200. */
const smoothRating = sql<number>`((${providers.ratingAvg} * ${providers.reviewsCount} + 4.6 * 6) / (${providers.reviewsCount} + 6))`;

const STOP = new Set(["нужен", "нужна", "нужно", "нужны", "ищу", "срочно", "мне", "для", "на", "в", "во", "по", "с", "и", "или", "как", "под", "у", "из", "хочу", "надо", "сделать", "помочь", "помощь", "саратов", "саратове", "недорого", "хороший", "хорошего", "мастер"]);

export function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t))
    .slice(0, 6);
}

/** Maps free text to catalogue entries (subcategories & services). */
export async function matchCatalog(q: string) {
  const tokens = tokenize(q);
  if (!tokens.length) return { subs: [] as { id: number; slug: string; name: string; score: number }[], services: [] as { id: number; slug: string; name: string; subcategoryId: number; score: number }[] };
  const scoreOf = (col: SQL | typeof subcategories.keywords) =>
    sql<number>`(${sql.join(
      tokens.map((t) => sql`word_similarity(${t}, ${col})`),
      sql` + `,
    )}) / ${tokens.length}`;
  const subText = sql`lower(replace(${subcategories.name} || ' ' || ${subcategories.namePlural} || ' ' || ${subcategories.keywords}, 'ё', 'е'))`;
  const svcText = sql`lower(replace(s.name || ' ' || s.keywords, 'ё', 'е'))`;
  const subs = await db
    .select({ id: subcategories.id, slug: subcategories.slug, name: subcategories.name, score: scoreOf(subText) })
    .from(subcategories)
    .where(and(eq(subcategories.isActive, true), sql`${scoreOf(subText)} > 0.5`))
    .orderBy(desc(scoreOf(subText)))
    .limit(4);
  const svcRows = await db.execute<{ id: number; slug: string; name: string; subcategory_id: number; score: number }>(
    sql`select s.id, s.slug, s.name, s.subcategory_id, ${scoreOf(svcText)} as score from services s where ${scoreOf(svcText)} > 0.5 order by score desc limit 6`,
  );
  return {
    subs,
    services: svcRows.rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, subcategoryId: r.subcategory_id, score: Number(r.score) })),
  };
}

export type SearchResult = { items: ProviderCard[]; total: number; page: number; pageSize: number; matched: Awaited<ReturnType<typeof matchCatalog>> };

export async function searchProviders(cityId: number, q: SearchQuery, pageSize = 24): Promise<SearchResult> {
  const catalog = await getCatalog();
  const page = q.page ?? 1;
  const conds: SQL[] = [eq(providers.status, "active"), eq(providers.cityId, cityId)];
  const hasGeo = q.lat != null && q.lng != null;
  const dist = hasGeo ? distanceExpr(q.lat!, q.lng!) : null;

  // category / subcategory filters (primary or secondary specialities)
  let subIds: number[] | null = null;
  if (q.sub) {
    const s = catalog.subBySlug.get(q.sub);
    subIds = s ? [s.id] : [-1];
  } else if (q.category) {
    const c = catalog.catBySlug.get(q.category);
    subIds = c ? [...catalog.subById.values()].filter((s) => s.categoryId === c.id).map((s) => s.id) : [-1];
  }
  if (subIds) {
    conds.push(
      or(
        inArray(providers.primarySubcategoryId, subIds),
        sql`exists (select 1 from ${providerSubcategories} ps where ps.provider_id = ${providers.id} and ps.subcategory_id in (${sql.join(subIds.map((i) => sql`${i}`), sql`, `)}))`,
      )!,
    );
  }

  // free text
  let relevance: SQL<number> = sql<number>`0`;
  let matched: SearchResult["matched"] = { subs: [], services: [] };
  if (q.q && q.q.trim()) {
    const tokens = tokenize(q.q);
    matched = await matchCatalog(q.q);
    const matchedSubIds = [...new Set([...matched.subs.map((s) => s.id), ...matched.services.map((s) => s.subcategoryId)])];
    if (tokens.length) {
      const textScore = sql<number>`((${sql.join(
        tokens.map((t) => sql`word_similarity(${t}, ${providers.searchText})`),
        sql` + `,
      )}) / ${tokens.length})`;
      const subBoost = matchedSubIds.length
        ? sql<number>`(case when ${providers.primarySubcategoryId} in (${sql.join(matchedSubIds.map((i) => sql`${i}`), sql`, `)}) then 0.6 when exists (select 1 from ${providerSubcategories} ps2 where ps2.provider_id = ${providers.id} and ps2.subcategory_id in (${sql.join(matchedSubIds.map((i) => sql`${i}`), sql`, `)})) then 0.4 else 0 end)`
        : sql<number>`0`;
      relevance = sql<number>`(${textScore} + ${subBoost})`;
      conds.push(sql`(${textScore} > 0.55 or ${subBoost} > 0)`);
    } else {
      conds.push(sql`false`);
    }
  }

  if (q.district) {
    const [d] = await db.select().from(districts).where(and(eq(districts.cityId, cityId), eq(districts.slug, q.district)));
    if (d) {
      conds.push(
        or(
          eq(providers.districtId, d.id),
          eq(providers.worksCityWide, true),
          sql`exists (select 1 from ${providerDistricts} pd where pd.provider_id = ${providers.id} and pd.district_id = ${d.id})`,
        )!,
      );
    }
  }
  if (q.available) conds.push(eq(providers.isAvailable, true));
  if (q.verified) conds.push(sql`${providers.verification} <> 'none'`);
  if (q.priceMax) conds.push(sql`coalesce(${providers.priceFrom}, 0) <= ${q.priceMax}`);

  // Paid boost only affects order while the "promotion" channel is on; boosted cards are labelled «Реклама».
  const promoted: SQL[] = channelOn("promotion") ? [desc(sql`(case when ${providers.boostedUntil} > now() then 1 else 0 end)`)] : [];
  const sort = q.sort ?? (q.q ? "relevance" : hasGeo ? "distance" : "rating");
  const order: SQL[] = [];
  if (sort === "distance" && dist) order.push(sql`${dist} asc nulls last`);
  else if (sort === "price") order.push(sql`${providers.priceFrom} asc nulls last`);
  else if (sort === "reviews") order.push(desc(providers.reviewsCount));
  else if (sort === "relevance") order.push(...promoted, sql`${relevance} desc`, desc(smoothRating));
  else order.push(...promoted, desc(smoothRating));
  order.push(desc(providers.isAvailable), asc(providers.id));

  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    baseCardQuery(dist)
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(providers)
      .where(where),
  ]);
  return { items: rows.map((r) => toCard(r as CardRow)), total, page, pageSize, matched };
}

export async function listProviders(
  cityId: number,
  opts: { sort: "top" | "new" | "available" | "nearby" | "promoted"; limit?: number; subIds?: number[]; lat?: number; lng?: number; excludeId?: string },
) {
  const dist = opts.lat != null && opts.lng != null ? distanceExpr(opts.lat, opts.lng) : null;
  const conds: SQL[] = [eq(providers.status, "active"), eq(providers.cityId, cityId)];
  if (opts.subIds?.length) conds.push(inArray(providers.primarySubcategoryId, opts.subIds));
  if (opts.sort === "available") conds.push(eq(providers.isAvailable, true));
  if (opts.sort === "promoted") conds.push(channelOn("promotion") ? sql`${providers.boostedUntil} > now()` : sql`false`);
  if (opts.excludeId) conds.push(sql`${providers.id} <> ${opts.excludeId}`);
  const order =
    opts.sort === "new"
      ? [desc(providers.approvedAt)]
      : opts.sort === "nearby" && dist
        ? [sql`${dist} asc nulls last`]
        : opts.sort === "available"
          ? [asc(sql`coalesce(${providers.responseTimeMin}, 999)`), desc(smoothRating)]
          : [desc(smoothRating), desc(providers.ordersCompleted)];
  const rows = await baseCardQuery(dist)
    .where(and(...conds))
    .orderBy(...order)
    .limit(opts.limit ?? 10);
  return rows.map((r) => toCard(r as CardRow));
}

export async function getProviderCardsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await baseCardQuery(null).where(inArray(providers.id, ids));
  return rows.map((r) => toCard(r as CardRow));
}

export async function getProviderProfile(slug: string) {
  const [row] = await baseCardQuery(null).where(eq(providers.slug, slug)).limit(1);
  if (!row) return null;
  const [p] = await db.select().from(providers).where(eq(providers.slug, slug));
  const [svcList, portfolio, reviewRows, subs, workDistricts, dist] = await Promise.all([
    db.select().from(providerServices).where(eq(providerServices.providerId, p.id)).orderBy(asc(providerServices.sortOrder)),
    db.select().from(portfolioItems).where(eq(portfolioItems.providerId, p.id)).orderBy(asc(portfolioItems.sortOrder), desc(portfolioItems.createdAt)),
    db
      .select({ id: reviews.id, rating: reviews.rating, text: reviews.text, photos: reviews.photos, reply: reviews.reply, createdAt: reviews.createdAt, authorName: users.name, authorAvatar: users.avatarUrl, orderId: reviews.orderId })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .where(and(eq(reviews.providerId, p.id), eq(reviews.status, "visible")))
      .orderBy(desc(reviews.createdAt))
      .limit(30),
    db
      .select({ id: subcategories.id, name: subcategories.name, slug: subcategories.slug })
      .from(providerSubcategories)
      .innerJoin(subcategories, eq(subcategories.id, providerSubcategories.subcategoryId))
      .where(eq(providerSubcategories.providerId, p.id)),
    db
      .select({ id: districts.id, name: districts.name })
      .from(providerDistricts)
      .innerJoin(districts, eq(districts.id, providerDistricts.districtId))
      .where(eq(providerDistricts.providerId, p.id)),
    db
      .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.providerId, p.id), eq(reviews.status, "visible")))
      .groupBy(reviews.rating),
  ]);
  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?.count ?? 0 }));
  return { card: toCard(row as CardRow), provider: p, services: svcList, portfolio, reviews: reviewRows, subs, workDistricts, ratingDistribution };
}

export async function isFavorite(userId: string, providerId: string) {
  const [f] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.providerId, providerId)));
  return !!f;
}

export async function listFavorites(userId: string) {
  const rows = await db.select({ providerId: favorites.providerId }).from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  const cards = await getProviderCardsByIds(rows.map((r) => r.providerId));
  const order = new Map(rows.map((r, i) => [r.providerId, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function favoriteIds(userId: string | undefined | null) {
  if (!userId) return new Set<string>();
  const rows = await db.select({ id: favorites.providerId }).from(favorites).where(eq(favorites.userId, userId));
  return new Set(rows.map((r) => r.id));
}

/** Providers that should get a new order (matching speciality, city, area). */
export async function matchingProvidersForOrder(o: { subcategoryId: number; cityId: number; districtId: number | null; lat: number | null; lng: number | null }, limit = 30) {
  const dist = o.lat != null && o.lng != null ? distanceExpr(o.lat, o.lng) : null;
  const rows = await db
    .select({ id: providers.id, userId: providers.userId, promoUntil: providers.promoUntil, distanceKm: dist ?? sql<number | null>`null::float`, radiusKm: providers.radiusKm, worksCityWide: providers.worksCityWide, districtId: providers.districtId })
    .from(providers)
    .where(
      and(
        eq(providers.status, "active"),
        eq(providers.cityId, o.cityId),
        or(
          eq(providers.primarySubcategoryId, o.subcategoryId),
          sql`exists (select 1 from ${providerSubcategories} ps where ps.provider_id = ${providers.id} and ps.subcategory_id = ${o.subcategoryId})`,
        ),
      ),
    )
    .limit(200);
  return rows
    .filter((r) => r.worksCityWide || r.distanceKm == null || r.distanceKm <= r.radiusKm + 2 || (o.districtId != null && r.districtId === o.districtId))
    .slice(0, limit);
}

/** Active provider counts per category and per subcategory (for tiles). */
export async function providerCounts(cityId: number) {
  const rows = await db
    .select({ subId: providers.primarySubcategoryId, n: sql<number>`count(*)::int`, available: sql<number>`count(*) filter (where ${providers.isAvailable})::int` })
    .from(providers)
    .where(and(eq(providers.status, "active"), eq(providers.cityId, cityId)))
    .groupBy(providers.primarySubcategoryId);
  const catalog = await getCatalog();
  const bySub = new Map<number, number>();
  const byCat = new Map<number, number>();
  let available = 0;
  let total = 0;
  for (const r of rows) {
    bySub.set(r.subId, r.n);
    const sub = catalog.subById.get(r.subId);
    if (sub) byCat.set(sub.categoryId, (byCat.get(sub.categoryId) ?? 0) + r.n);
    available += r.available;
    total += r.n;
  }
  return { bySub, byCat, available, total };
}
