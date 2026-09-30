import "server-only";
import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  adminActions, ads, categories, cities, contentBlocks, districts, invoices, orders, promoCodes, providerDocuments, providers, reports, reviews, subcategories, supportTickets, users,
} from "../db/schema";
import type { CurrentUser } from "../auth/session";
import { badRequest, forbidden, notFound } from "../http/errors";
import { notify } from "../notifications/notify";
import { invalidateCatalog } from "./catalog";
import { recomputeProviderStats } from "./provider-stats";
import { activate, cancelInvoice, grant } from "../billing";

export async function audit(admin: CurrentUser, action: string, targetType: string, targetId: string, data?: Record<string, unknown>) {
  await db.insert(adminActions).values({ adminId: admin.id, action, targetType, targetId, data });
}

/* ───────── analytics ───────── */

export async function dashboardStats(days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  const [[u], [p], [o], [money], [conv], [rt], topCats, topDistricts, series, userSeries] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, fresh: sql<number>`count(*) filter (where ${users.createdAt} >= ${since})::int` }).from(users),
    db
      .select({
        total: sql<number>`count(*) filter (where ${providers.status} = 'active')::int`,
        pending: sql<number>`count(*) filter (where ${providers.status} = 'pending')::int`,
        fresh: sql<number>`count(*) filter (where ${providers.createdAt} >= ${since})::int`,
        available: sql<number>`count(*) filter (where ${providers.status} = 'active' and ${providers.isAvailable})::int`,
      })
      .from(providers),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${orders.status} in ('new','responses','assigned','in_progress'))::int`,
        completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
        period: sql<number>`count(*) filter (where ${orders.createdAt} >= ${since})::int`,
      })
      .from(orders),
    db
      .select({
        gmv: sql<number>`coalesce(sum(${orders.agreedPrice}) filter (where ${orders.status} = 'completed'), 0)::int`,
        avgCheck: sql<number>`coalesce(avg(${orders.agreedPrice}) filter (where ${orders.status} = 'completed'), 0)::int`,
        gmvPeriod: sql<number>`coalesce(sum(${orders.agreedPrice}) filter (where ${orders.status} = 'completed' and ${orders.completedAt} >= ${since}), 0)::int`,
      })
      .from(orders),
    db
      .select({
        created: sql<number>`count(*)::int`,
        assigned: sql<number>`count(*) filter (where ${orders.providerId} is not null)::int`,
        completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
      })
      .from(orders)
      .where(gte(orders.createdAt, since)),
    db.select({ avg: sql<number | null>`avg(${providers.responseTimeMin})::int` }).from(providers).where(eq(providers.status, "active")),
    db
      .select({ name: categories.name, count: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(subcategories, eq(subcategories.id, orders.subcategoryId))
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .groupBy(categories.name)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({ name: districts.name, count: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(districts, eq(districts.id, orders.districtId))
      .groupBy(districts.name)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db.execute<{ day: string; orders: number; gmv: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        (select count(*)::int from orders where created_at::date = d) as orders,
        (select coalesce(sum(agreed_price),0)::int from orders where status = 'completed' and completed_at::date = d) as gmv
      from generate_series((now() - interval '${sql.raw(String(days - 1))} days')::date, now()::date, '1 day') d`),
    db.execute<{ day: string; users: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day, (select count(*)::int from users where created_at::date = d) as users
      from generate_series((now() - interval '${sql.raw(String(days - 1))} days')::date, now()::date, '1 day') d`),
  ]);
  const [openReports] = await db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "open"));
  const [openTickets] = await db.select({ n: sql<number>`count(*)::int` }).from(supportTickets).where(eq(supportTickets.status, "open"));
  // Platform revenue = activated paid services only (orders never carry money for the platform).
  const [revenue] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.amount} - ${invoices.discount}), 0)::int`,
      period: sql<number>`coalesce(sum(${invoices.amount} - ${invoices.discount}) filter (where ${invoices.activatedAt} >= ${since}), 0)::int`,
      requested: sql<number>`count(*) filter (where ${invoices.status} = 'requested')::int`,
    })
    .from(invoices)
    .where(sql`${invoices.status} in ('activated', 'requested')`);
  return {
    users: u,
    providers: p,
    orders: o,
    money,
    conversion: {
      ...conv,
      assignRate: conv.created ? Math.round((conv.assigned / conv.created) * 100) : 0,
      completeRate: conv.created ? Math.round((conv.completed / conv.created) * 100) : 0,
    },
    avgResponseMin: rt.avg,
    topCats,
    topDistricts,
    series: series.rows.map((r) => ({ day: r.day, orders: Number(r.orders), gmv: Number(r.gmv) })),
    userSeries: userSeries.rows.map((r) => ({ day: r.day, users: Number(r.users) })),
    openReports: openReports.n,
    openTickets: openTickets.n,
    platformRevenue: revenue.total,
    platformRevenuePeriod: revenue.period,
    openInvoices: revenue.requested,
  };
}

/* ───────── lists ───────── */

const PAGE = 30;
export type ListParams = { q?: string; status?: string; page?: number };

export async function adminUsers({ q, page = 1 }: ListParams) {
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`), ilike(users.telegramUsername, `%${q}%`))!);
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({ u: users, providerSlug: providers.slug, providerStatus: providers.status })
    .from(users)
    .leftJoin(providers, eq(providers.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminProviders({ q, status, page = 1 }: ListParams) {
  const conds: SQL[] = [];
  if (status) conds.push(eq(providers.status, status as "active"));
  if (q) conds.push(or(ilike(providers.displayName, `%${q}%`), ilike(providers.slug, `%${q}%`))!);
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({
      p: providers,
      subName: subcategories.name,
      email: users.email,
      docs: sql<number>`(select count(*)::int from ${providerDocuments} d where d.provider_id = ${providers.id})`,
    })
    .from(providers)
    .innerJoin(subcategories, eq(subcategories.id, providers.primarySubcategoryId))
    .innerJoin(users, eq(users.id, providers.userId))
    .where(where)
    .orderBy(sql`case when ${providers.status} = 'pending' then 0 else 1 end`, desc(providers.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(providers).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminOrders({ q, status, page = 1 }: ListParams) {
  const conds: SQL[] = [];
  if (status) conds.push(eq(orders.status, status as "new"));
  if (q) conds.push(or(ilike(orders.title, `%${q}%`), sql`${orders.number}::text = ${q.replace(/\D/g, "") || "-1"}`)!);
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({ o: orders, subName: subcategories.name, clientName: users.name, providerName: providers.displayName })
    .from(orders)
    .innerJoin(subcategories, eq(subcategories.id, orders.subcategoryId))
    .innerJoin(users, eq(users.id, orders.clientId))
    .leftJoin(providers, eq(providers.id, orders.providerId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(orders).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminReviews({ q, status, page = 1 }: ListParams) {
  const conds: SQL[] = [];
  if (status) conds.push(eq(reviews.status, status as "visible"));
  if (q) conds.push(ilike(reviews.text, `%${q}%`));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({ r: reviews, authorName: users.name, providerName: providers.displayName, providerSlug: providers.slug })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .innerJoin(providers, eq(providers.id, reviews.providerId))
    .where(where)
    .orderBy(desc(reviews.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(reviews).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminReports({ status = "open", page = 1 }: ListParams) {
  const where = status === "all" ? undefined : eq(reports.status, status as "open");
  const rows = await db
    .select({ r: reports, reporterName: users.name })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(where)
    .orderBy(desc(reports.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(reports).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminTickets({ status, page = 1 }: ListParams) {
  const where = status ? eq(supportTickets.status, status as "open") : undefined;
  const rows = await db
    .select({ t: supportTickets, userName: users.name, userEmail: users.email })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .where(where)
    .orderBy(sql`case when ${supportTickets.status} = 'open' then 0 else 1 end`, desc(supportTickets.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(supportTickets).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminInvoices({ status, page = 1 }: ListParams) {
  const where = status ? eq(invoices.status, status as "requested") : undefined;
  const rows = await db
    .select({ i: invoices, userName: users.name, email: users.email, providerName: providers.displayName, providerSlug: providers.slug })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .innerJoin(providers, eq(providers.id, invoices.providerId))
    .where(where)
    .orderBy(desc(invoices.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(invoices).where(where);
  return { rows, total, page, pageSize: PAGE };
}

export async function adminAds() {
  return db.select().from(ads).orderBy(desc(ads.createdAt)).limit(100);
}

export async function adminAudit(page = 1) {
  const rows = await db
    .select({ a: adminActions, adminName: users.name })
    .from(adminActions)
    .leftJoin(users, eq(users.id, adminActions.adminId))
    .orderBy(desc(adminActions.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  return { rows, page, pageSize: PAGE };
}

export async function adminGeo() {
  const cs = await db.select().from(cities).orderBy(asc(cities.sortOrder));
  const ds = await db.select().from(districts).orderBy(asc(districts.sortOrder));
  return cs.map((c) => ({ ...c, districts: ds.filter((d) => d.cityId === c.id) }));
}

export async function adminCategories() {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  const subs = await db
    .select({ s: subcategories, providers: sql<number>`(select count(*)::int from providers p where p.primary_subcategory_id = ${subcategories.id} and p.status = 'active')` })
    .from(subcategories)
    .orderBy(asc(subcategories.sortOrder));
  return cats.map((c) => ({ ...c, subs: subs.filter((s) => s.s.categoryId === c.id).map((s) => ({ ...s.s, providers: s.providers })) }));
}

/* ───────── actions ───────── */

export type AdminActionInput =
  | { type: "provider.approve"; id: string; verification?: "none" | "verified" | "pro" | "business" }
  | { type: "provider.reject"; id: string; note: string }
  | { type: "provider.suspend"; id: string; note?: string }
  | { type: "provider.verification"; id: string; verification: "none" | "verified" | "pro" | "business" }
  | { type: "user.block"; id: string; blocked: boolean }
  | { type: "user.role"; id: string; role: "user" | "moderator" | "admin" }
  | { type: "review.visibility"; id: string; status: "visible" | "hidden" }
  | { type: "report.resolve"; id: string; status: "resolved" | "rejected"; resolution?: string }
  | { type: "ticket.answer"; id: string; answer: string; close?: boolean }
  | { type: "order.cancel"; id: string; reason: string }
  | { type: "promo.create"; code: string; discountPct: number; maxUses?: number | null; validUntil?: string | null }
  | { type: "promo.toggle"; id: number; isActive: boolean }
  | { type: "city.toggle"; id: number; isActive: boolean }
  | { type: "district.create"; cityId: number; name: string; slug: string; lat: number; lng: number }
  | { type: "category.update"; id: number; name?: string; isActive?: boolean; sortOrder?: number; description?: string }
  | { type: "subcategory.create"; categoryId: number; name: string; namePlural: string; slug: string; icon: string; keywords?: string }
  | { type: "subcategory.toggle"; id: number; isActive: boolean }
  | { type: "content.update"; key: string; title: string; body: string; isActive: boolean }
  | { type: "invoice.activate"; id: string }
  | { type: "invoice.cancel"; id: string; note: string }
  | { type: "billing.grant"; slug: string; productId: string }
  | { type: "ad.create"; slot: "home" | "category" | "search"; categoryId?: number | null; title: string; body?: string; linkUrl: string; advertiser: string; erid?: string | null; startsAt: string; endsAt: string }
  | { type: "ad.toggle"; id: string; isActive: boolean };

export async function runAdminAction(admin: CurrentUser, a: AdminActionInput) {
  const adminOnly = new Set(["user.role", "promo.create", "promo.toggle", "city.toggle", "district.create", "category.update", "subcategory.create", "subcategory.toggle", "content.update", "invoice.activate", "invoice.cancel", "billing.grant", "ad.create", "ad.toggle"]);
  if (adminOnly.has(a.type) && admin.role !== "admin") throw forbidden("Действие доступно только администратору");

  switch (a.type) {
    case "provider.approve": {
      const [p] = await db
        .update(providers)
        .set({ status: "active", approvedAt: new Date(), moderationNote: null, ...(a.verification ? { verification: a.verification } : {}) })
        .where(eq(providers.id, a.id))
        .returning();
      if (!p) throw notFound();
      await db.update(providerDocuments).set({ status: "approved" }).where(eq(providerDocuments.providerId, p.id));
      await notify(p.userId, { type: "provider.moderation", title: "Профиль одобрен 🎉", body: "Теперь вы в поиске и можете откликаться на заявки.", link: "/pro" });
      break;
    }
    case "provider.reject": {
      const [p] = await db.update(providers).set({ status: "rejected", moderationNote: a.note }).where(eq(providers.id, a.id)).returning();
      if (!p) throw notFound();
      await notify(p.userId, { type: "provider.moderation", title: "Профиль требует доработки", body: a.note, link: "/pro/profile" });
      break;
    }
    case "provider.suspend": {
      const [p] = await db.update(providers).set({ status: "suspended", moderationNote: a.note ?? null }).where(eq(providers.id, a.id)).returning();
      if (!p) throw notFound();
      await notify(p.userId, { type: "provider.moderation", title: "Профиль приостановлен", body: a.note ?? "Свяжитесь с поддержкой для уточнения.", link: "/support" });
      break;
    }
    case "provider.verification":
      await db.update(providers).set({ verification: a.verification }).where(eq(providers.id, a.id));
      break;
    case "user.block":
      if (a.id === admin.id) throw badRequest("Нельзя заблокировать себя");
      await db.update(users).set({ isBlocked: a.blocked }).where(eq(users.id, a.id));
      if (a.blocked) await db.execute(sql`delete from sessions where user_id = ${a.id}`);
      break;
    case "user.role":
      if (a.id === admin.id) throw badRequest("Нельзя изменить свою роль");
      await db.update(users).set({ role: a.role }).where(eq(users.id, a.id));
      break;
    case "review.visibility": {
      const [r] = await db.update(reviews).set({ status: a.status }).where(eq(reviews.id, a.id)).returning();
      if (!r) throw notFound();
      await recomputeProviderStats(db, r.providerId);
      break;
    }
    case "report.resolve":
      await db.update(reports).set({ status: a.status, resolution: a.resolution ?? null, resolvedById: admin.id, resolvedAt: new Date() }).where(eq(reports.id, a.id));
      break;
    case "ticket.answer": {
      const [t] = await db
        .update(supportTickets)
        .set({ answer: a.answer, status: a.close ? "closed" : "answered", answeredAt: new Date() })
        .where(eq(supportTickets.id, a.id))
        .returning();
      if (t?.userId) await notify(t.userId, { type: "system", title: `Ответ поддержки: ${t.subject}`, body: a.answer.slice(0, 200), link: "/support" });
      break;
    }
    case "order.cancel": {
      const [o] = await db.update(orders).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: `Модерация: ${a.reason}` }).where(eq(orders.id, a.id)).returning();
      if (o) await notify(o.clientId, { type: "order.status", title: "Заказ отменён модератором", body: a.reason, link: `/orders/${o.id}` });
      break;
    }
    case "promo.create":
      if (a.discountPct < 1 || a.discountPct > 100) throw badRequest("Скидка 1–100%");
      await db.insert(promoCodes).values({ code: a.code.toUpperCase().trim(), discountPct: a.discountPct, maxUses: a.maxUses ?? null, validUntil: a.validUntil ? new Date(a.validUntil) : null });
      break;
    case "promo.toggle":
      await db.update(promoCodes).set({ isActive: a.isActive }).where(eq(promoCodes.id, a.id));
      break;
    case "city.toggle":
      await db.update(cities).set({ isActive: a.isActive }).where(eq(cities.id, a.id));
      invalidateCatalog();
      break;
    case "district.create":
      await db.insert(districts).values({ cityId: a.cityId, name: a.name, slug: a.slug, lat: a.lat, lng: a.lng });
      invalidateCatalog();
      break;
    case "category.update":
      await db.update(categories).set({ name: a.name, isActive: a.isActive, sortOrder: a.sortOrder, description: a.description }).where(eq(categories.id, a.id));
      invalidateCatalog();
      break;
    case "subcategory.create":
      await db.insert(subcategories).values({ categoryId: a.categoryId, name: a.name, namePlural: a.namePlural, slug: a.slug, icon: a.icon, keywords: a.keywords ?? "" });
      invalidateCatalog();
      break;
    case "subcategory.toggle":
      await db.update(subcategories).set({ isActive: a.isActive }).where(eq(subcategories.id, a.id));
      invalidateCatalog();
      break;
    case "invoice.activate":
      await activate(a.id, admin.id);
      break;
    case "invoice.cancel":
      await cancelInvoice(admin, a.id, a.note);
      break;
    case "billing.grant": {
      const [p] = await db.select({ id: providers.id }).from(providers).where(eq(providers.slug, a.slug.trim()));
      if (!p) throw notFound("Исполнитель с таким адресом профиля не найден");
      await grant(p.id, a.productId);
      break;
    }
    case "ad.create": {
      const startsAt = new Date(a.startsAt);
      const endsAt = new Date(a.endsAt);
      if (!(endsAt > startsAt)) throw badRequest("Дата окончания должна быть позже даты начала");
      await db.insert(ads).values({ slot: a.slot, categoryId: a.categoryId ?? null, title: a.title, body: a.body ?? "", linkUrl: a.linkUrl, advertiser: a.advertiser, erid: a.erid || null, startsAt, endsAt });
      break;
    }
    case "ad.toggle":
      await db.update(ads).set({ isActive: a.isActive }).where(eq(ads.id, a.id));
      break;
    case "content.update":
      await db
        .insert(contentBlocks)
        .values({ key: a.key, title: a.title, body: a.body, isActive: a.isActive })
        .onConflictDoUpdate({ target: contentBlocks.key, set: { title: a.title, body: a.body, isActive: a.isActive, updatedAt: new Date() } });
      break;
  }
  const targetId = "id" in a ? String(a.id) : "code" in a ? a.code : "key" in a ? a.key : "slug" in a ? a.slug : "new";
  await audit(admin, a.type, a.type.split(".")[0], targetId, a as unknown as Record<string, unknown>);
}

export async function getDocument(id: string) {
  const [d] = await db.select().from(providerDocuments).where(eq(providerDocuments.id, id));
  return d ?? null;
}
