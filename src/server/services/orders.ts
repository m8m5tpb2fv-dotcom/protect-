import "server-only";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { URGENCY } from "@/lib/format";
import type { CreateOrderInput } from "@/lib/validation";
import { db, type DbOrTx } from "../db";
import {
  categories, conversations, districts, messages, orderDismissals, orderEvents, orderPhotos, orderResponses, orders, providers, providerSubcategories, reviews, services, subcategories, users, type Order,
} from "../db/schema";
import type { CurrentUser } from "../auth/session";
import { badRequest, conflict, forbidden, notFound } from "../http/errors";
import { notify } from "../notifications/notify";
import { getGeo } from "./catalog";
import { matchingProvidersForOrder } from "./providers";
import { logOrderEvent, recomputeProviderStats } from "./provider-stats";
import { newOrderCard } from "../telegram/cards";

export const OPEN_STATUSES = ["new", "responses"] as const;

/** In-app + Telegram card (with «Откликнуться» / «Не интересно») for each provider who should see a new order. */
async function notifyNewOrder(order: Order, recipients: { userId: string; distanceKm: number | null }[], direct: boolean) {
  if (!recipients.length) return;
  const [[meta], [{ photos }]] = await Promise.all([
    db
      .select({ subName: subcategories.name, districtName: districts.name })
      .from(subcategories)
      .leftJoin(districts, order.districtId != null ? eq(districts.id, order.districtId) : sql`false`)
      .where(eq(subcategories.id, order.subcategoryId)),
    db.select({ photos: sql<number>`count(*)::int` }).from(orderPhotos).where(eq(orderPhotos.orderId, order.id)),
  ]);
  const urgencyLabel = URGENCY[order.urgency].label.toLowerCase();
  for (const r of recipients) {
    const km = r.distanceKm != null ? ` · ${r.distanceKm.toFixed(1).replace(".", ",")} км` : "";
    await notify(r.userId, {
      type: "order.new",
      title: direct ? "Новый заказ для вас" : "Новая заявка рядом",
      body: `«${order.title}» · ${urgencyLabel}${km}`,
      link: `/orders/${order.id}`,
      telegram: newOrderCard({ ...order, subName: meta?.subName ?? "", districtName: meta?.districtName ?? null, distanceKm: r.distanceKm, photos, direct }),
    });
  }
}
export const ACTIVE_STATUSES = ["new", "responses", "assigned", "in_progress"] as const;

export async function createOrder(user: CurrentUser, input: CreateOrderInput, cityId: number) {
  const [sub] = await db.select().from(subcategories).where(eq(subcategories.id, input.subcategoryId));
  if (!sub || !sub.isActive) throw badRequest("Выберите услугу из списка");
  if (input.serviceId) {
    const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId));
    if (!svc || svc.subcategoryId !== sub.id) throw badRequest("Услуга не относится к выбранной категории");
  }
  const geo = await getGeo();
  const district = input.districtId ? geo.districtById.get(input.districtId) : undefined;
  if (input.districtId && (!district || district.cityId !== cityId)) throw badRequest("Район не найден");
  let direct: typeof providers.$inferSelect | undefined;
  if (input.directProviderId) {
    [direct] = await db.select().from(providers).where(eq(providers.id, input.directProviderId));
    if (!direct || direct.status !== "active") throw badRequest("Исполнитель сейчас не принимает заказы");
    if (direct.userId === user.id) throw badRequest("Нельзя заказать услугу у самого себя");
  }
  // anti-spam: max 10 open orders per client
  const [{ open }] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.clientId, user.id), inArray(orders.status, [...OPEN_STATUSES])));
  if (open >= 10) throw badRequest("У вас уже 10 открытых заявок. Закройте неактуальные, чтобы создать новую.");

  const lat = input.lat ?? district?.lat ?? null;
  const lng = input.lng ?? district?.lng ?? null;

  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        clientId: user.id,
        cityId,
        districtId: district?.id ?? null,
        subcategoryId: sub.id,
        serviceId: input.serviceId ?? null,
        title: input.title,
        description: input.description,
        address: input.address,
        lat,
        lng,
        urgency: input.urgency,
        budget: input.budget ?? null,
        contactPhone: input.contactPhone ?? null,
        directProviderId: direct?.id ?? null,
      })
      .returning();
    if (input.photos.length) await tx.insert(orderPhotos).values(input.photos.map((url) => ({ orderId: o.id, url })));
    await logOrderEvent(tx, o.id, user.id, "created", direct ? { directProviderId: direct.id } : undefined);
    return o;
  });

  if (direct) await notifyNewOrder(order, [{ userId: direct.userId, distanceKm: null }], true);
  else await notifyNewOrder(order, (await matchingProvidersForOrder(order)).filter((t) => t.userId !== user.id), false);
  return order;
}

export type ViewerRole = "client" | "provider" | "prospect" | "admin";

/** Resolves how the current user relates to the order; throws if they may not see it. */
export async function orderAccess(orderId: string, user: CurrentUser) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw notFound("Заказ не найден");
  if (o.clientId === user.id) return { order: o, role: "client" as ViewerRole };
  const p = user.provider;
  if (p) {
    if (o.providerId === p.id || o.directProviderId === p.id) return { order: o, role: "provider" as ViewerRole };
    const [resp] = await db.select({ id: orderResponses.id }).from(orderResponses).where(and(eq(orderResponses.orderId, o.id), eq(orderResponses.providerId, p.id)));
    if (resp) return { order: o, role: "provider" as ViewerRole };
    if (p.status === "active" && !o.directProviderId && (OPEN_STATUSES as readonly string[]).includes(o.status)) {
      const [match] = await db
        .select({ id: providers.id })
        .from(providers)
        .where(
          and(
            eq(providers.id, p.id),
            eq(providers.cityId, o.cityId),
            or(eq(providers.primarySubcategoryId, o.subcategoryId), sql`exists (select 1 from ${providerSubcategories} ps where ps.provider_id = ${p.id} and ps.subcategory_id = ${o.subcategoryId})`),
          ),
        );
      if (match) return { order: o, role: "prospect" as ViewerRole };
    }
  }
  if (user.role === "admin" || user.role === "moderator") return { order: o, role: "admin" as ViewerRole };
  throw forbidden("Этот заказ вам недоступен");
}

export async function getOrderDetail(orderId: string, user: CurrentUser) {
  const { order, role } = await orderAccess(orderId, user);
  const [sub] = await db
    .select({ name: subcategories.name, slug: subcategories.slug, icon: subcategories.icon, tone: categories.tone })
    .from(subcategories)
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .where(eq(subcategories.id, order.subcategoryId));
  const [district] = order.districtId ? await db.select().from(districts).where(eq(districts.id, order.districtId)) : [];
  const photos = await db.select().from(orderPhotos).where(eq(orderPhotos.orderId, order.id));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(orderEvents.createdAt);
  const responseConds = [eq(orderResponses.orderId, order.id)];
  if (role === "provider" || role === "prospect") responseConds.push(eq(orderResponses.providerId, user.provider!.id));
  const responses = await db
    .select({
      id: orderResponses.id,
      message: orderResponses.message,
      price: orderResponses.price,
      eta: orderResponses.eta,
      status: orderResponses.status,
      createdAt: orderResponses.createdAt,
      providerId: providers.id,
      providerSlug: providers.slug,
      providerName: providers.displayName,
      providerAvatar: providers.avatarUrl,
      providerRating: providers.ratingAvg,
      providerReviews: providers.reviewsCount,
      providerOrders: providers.ordersCompleted,
      providerVerification: providers.verification,
      providerAvailable: providers.isAvailable,
      providerHeadline: providers.headline,
    })
    .from(orderResponses)
    .innerJoin(providers, eq(providers.id, orderResponses.providerId))
    .where(and(...responseConds))
    .orderBy(orderResponses.createdAt);
  const [client] = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, phone: users.phone }).from(users).where(eq(users.id, order.clientId));
  const [assigned] = order.providerId
    ? await db.select({ id: providers.id, slug: providers.slug, displayName: providers.displayName, avatarUrl: providers.avatarUrl, phone: providers.phone, userId: providers.userId, ratingAvg: providers.ratingAvg, reviewsCount: providers.reviewsCount }).from(providers).where(eq(providers.id, order.providerId))
    : [];
  const [review] = await db.select().from(reviews).where(eq(reviews.orderId, order.id));
  // contacts are revealed only after assignment
  const revealContacts = role === "admin" || (!!order.providerId && (order.status === "assigned" || order.status === "in_progress" || order.status === "completed"));
  let conversationId: string | null = null;
  if (role === "client" && assigned) {
    const [c] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.clientId, order.clientId), eq(conversations.providerId, assigned.id)));
    conversationId = c?.id ?? null;
  } else if ((role === "provider" || role === "prospect") && user.provider) {
    const [c] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.clientId, order.clientId), eq(conversations.providerId, user.provider.id)));
    conversationId = c?.id ?? null;
  }
  return {
    order: { ...order, contactPhone: revealContacts ? order.contactPhone : null, address: role === "prospect" ? maskAddress(order.address) : order.address },
    role,
    sub,
    district: district ?? null,
    photos,
    events,
    responses,
    client: { ...client, phone: revealContacts && role !== "client" ? (order.contactPhone ?? client.phone) : null },
    assigned: assigned ? { ...assigned, phone: revealContacts ? assigned.phone : null } : null,
    review: review ?? null,
    conversationId,
  };
}

/** Before assignment providers only see the street, not the flat. */
export function maskAddress(address: string) {
  return address.replace(/,\s*(кв\.?|квартира|под\.?|подъезд|эт\.?|этаж)\s*\d+.*$/i, "").replace(/(\d+)[а-яa-z]?\s*,?\s*(кв\.?|квартира)\s*\d+/i, "$1");
}

export async function respondToOrder(user: CurrentUser, orderId: string, input: { message: string; price?: number | null; eta?: string | null }) {
  const p = user.provider;
  if (!p) throw forbidden("Откликаться могут только исполнители");
  if (p.status !== "active") throw forbidden("Профиль ещё на проверке — откликаться можно после одобрения");
  const { order, role } = await orderAccess(orderId, user);
  if (role === "client") throw badRequest("Нельзя откликнуться на свой заказ");
  if (!(OPEN_STATUSES as readonly string[]).includes(order.status) && !(order.directProviderId === p.id && order.status === "new")) throw conflict("Заказ уже не принимает отклики");
  if (order.directProviderId && order.directProviderId !== p.id) throw forbidden();
  const [dup] = await db.select({ id: orderResponses.id }).from(orderResponses).where(and(eq(orderResponses.orderId, orderId), eq(orderResponses.providerId, p.id)));
  if (dup) throw conflict("Вы уже откликнулись на этот заказ");
  // Responses are a base feature: unlimited and free for every provider, PRO or not.

  const result = await db.transaction(async (tx) => {
    const [resp] = await tx.insert(orderResponses).values({ orderId, providerId: p.id, message: input.message, price: input.price ?? null, eta: input.eta ?? null }).returning();
    if (order.status === "new") await tx.update(orders).set({ status: "responses" }).where(eq(orders.id, orderId));
    await logOrderEvent(tx, orderId, user.id, "response", { providerId: p.id, price: input.price ?? null });
    const conversationId = await upsertConversation(tx, order.clientId, p.id, orderId);
    const body = `Отклик на заказ «${order.title}»${input.price ? ` · ${input.price.toLocaleString("ru-RU")} ₽` : ""}\n\n${input.message}`;
    await tx.insert(messages).values({ conversationId, senderId: user.id, body });
    await tx.update(conversations).set({ lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) }).where(eq(conversations.id, conversationId));
    return { resp, conversationId };
  });
  await notify(order.clientId, {
    type: "order.response",
    title: "Новый отклик на заявку",
    body: `${p.displayName}${input.price ? ` · ${input.price.toLocaleString("ru-RU")} ₽` : ""} — «${order.title}»`,
    link: `/orders/${orderId}`,
  });
  await recomputeProviderStats(db, p.id);
  return result;
}

export async function upsertConversation(tx: DbOrTx, clientId: string, providerId: string, orderId: string | null) {
  const [existing] = await tx.select().from(conversations).where(and(eq(conversations.clientId, clientId), eq(conversations.providerId, providerId)));
  if (existing) {
    if (orderId && existing.orderId !== orderId) await tx.update(conversations).set({ orderId }).where(eq(conversations.id, existing.id));
    return existing.id;
  }
  const [c] = await tx.insert(conversations).values({ clientId, providerId, orderId }).returning({ id: conversations.id });
  return c.id;
}

type Action =
  | { action: "choose"; responseId: string }
  | { action: "start" }
  | { action: "complete"; finalPrice?: number | null }
  | { action: "cancel"; reason?: string }
  | { action: "accept" }
  | { action: "decline" };

export async function orderAction(user: CurrentUser, orderId: string, a: Action) {
  const { order, role } = await orderAccess(orderId, user);
  const p = user.provider;
  const isAssignedProvider = !!p && order.providerId === p.id;
  const providerUser = async (providerId: string) => (await db.select({ userId: providers.userId, name: providers.displayName }).from(providers).where(eq(providers.id, providerId)))[0];

  switch (a.action) {
    case "choose": {
      if (role !== "client") throw forbidden();
      if (!(OPEN_STATUSES as readonly string[]).includes(order.status)) throw conflict("Исполнитель уже выбран");
      const [resp] = await db.select().from(orderResponses).where(and(eq(orderResponses.id, a.responseId), eq(orderResponses.orderId, orderId)));
      if (!resp || resp.status !== "pending") throw badRequest("Отклик не найден");
      await db.transaction(async (tx) => {
        await tx.update(orders).set({ status: "assigned", providerId: resp.providerId, agreedPrice: resp.price ?? order.budget, assignedAt: new Date() }).where(eq(orders.id, orderId));
        await tx.update(orderResponses).set({ status: "accepted" }).where(eq(orderResponses.id, resp.id));
        await tx.update(orderResponses).set({ status: "declined" }).where(and(eq(orderResponses.orderId, orderId), ne(orderResponses.id, resp.id), eq(orderResponses.status, "pending")));
        await logOrderEvent(tx, orderId, user.id, "assigned", { providerId: resp.providerId });
        await upsertConversation(tx, order.clientId, resp.providerId, orderId);
      });
      const pu = await providerUser(resp.providerId);
      await notify(pu.userId, { type: "order.assigned", title: "Вас выбрали исполнителем", body: `«${order.title}» — свяжитесь с клиентом в чате`, link: `/orders/${orderId}` });
      break;
    }
    case "accept": {
      if (!p || order.directProviderId !== p.id || order.status !== "new") throw forbidden();
      await db.transaction(async (tx) => {
        await tx.update(orders).set({ status: "assigned", providerId: p.id, agreedPrice: order.budget, assignedAt: new Date() }).where(eq(orders.id, orderId));
        await tx.insert(orderResponses).values({ orderId, providerId: p.id, message: "Принял заказ", price: order.budget, status: "accepted" }).onConflictDoNothing();
        await logOrderEvent(tx, orderId, user.id, "assigned", { providerId: p.id, direct: true });
        await upsertConversation(tx, order.clientId, p.id, orderId);
      });
      await notify(order.clientId, { type: "order.assigned", title: "Исполнитель принял заказ", body: `${p.displayName} — «${order.title}»`, link: `/orders/${orderId}` });
      break;
    }
    case "decline": {
      if (!p || order.directProviderId !== p.id || order.status !== "new") throw forbidden();
      await db.update(orders).set({ directProviderId: null }).where(eq(orders.id, orderId));
      await logOrderEvent(db, orderId, user.id, "declined", { providerId: p.id });
      await notify(order.clientId, { type: "order.status", title: "Исполнитель не сможет взять заказ", body: "Мы отправили вашу заявку другим специалистам рядом.", link: `/orders/${orderId}` });
      const targets = await matchingProvidersForOrder(order);
      await notifyNewOrder(order, targets.filter((t) => t.id !== p.id && t.userId !== order.clientId), false);
      break;
    }
    case "start": {
      if (!isAssignedProvider || order.status !== "assigned") throw forbidden();
      await db.update(orders).set({ status: "in_progress", startedAt: new Date() }).where(eq(orders.id, orderId));
      await logOrderEvent(db, orderId, user.id, "started");
      await notify(order.clientId, { type: "order.status", title: "Исполнитель приступил к работе", body: `«${order.title}»`, link: `/orders/${orderId}` });
      break;
    }
    case "complete": {
      if (!(role === "client" || isAssignedProvider)) throw forbidden();
      if (order.status !== "in_progress" && order.status !== "assigned") throw conflict("Заказ нельзя завершить в текущем статусе");
      // The price is informational: the client pays the provider directly and the platform takes no commission.
      const price = a.finalPrice ?? order.agreedPrice ?? null;
      await db.transaction(async (tx) => {
        await tx.update(orders).set({ status: "completed", completedAt: new Date(), agreedPrice: price }).where(eq(orders.id, orderId));
        await tx
          .update(providers)
          .set({ ordersCompleted: sql`${providers.ordersCompleted} + 1`, clientsCount: sql`${providers.clientsCount} + 1` })
          .where(eq(providers.id, order.providerId!));
        await logOrderEvent(tx, orderId, user.id, "completed", { price, by: role });
      });
      await recomputeProviderStats(db, order.providerId!);
      const pu = await providerUser(order.providerId!);
      if (role === "client") await notify(pu.userId, { type: "order.status", title: "Клиент подтвердил выполнение", body: `«${order.title}»`, link: `/orders/${orderId}` });
      await notify(order.clientId, { type: "review.new", title: "Как всё прошло?", body: `Оцените работу: ${pu.name}. Отзыв поможет другим сделать выбор.`, link: `/orders/${orderId}#review` });
      break;
    }
    case "cancel": {
      if (order.status === "completed" || order.status === "cancelled") throw conflict("Заказ уже закрыт");
      if (role === "client") {
        await db.update(orders).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: a.reason ?? null }).where(eq(orders.id, orderId));
        await logOrderEvent(db, orderId, user.id, "cancelled", { reason: a.reason ?? null });
        if (order.providerId) {
          const pu = await providerUser(order.providerId);
          await notify(pu.userId, { type: "order.status", title: "Клиент отменил заказ", body: `«${order.title}»${a.reason ? ` — ${a.reason}` : ""}`, link: `/orders/${orderId}` });
        }
      } else if (isAssignedProvider) {
        // provider withdraws: order returns to the open pool
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(orderResponses).where(and(eq(orderResponses.orderId, orderId), eq(orderResponses.status, "pending")));
        await db.transaction(async (tx) => {
          await tx.update(orders).set({ status: n > 0 ? "responses" : "new", providerId: null, directProviderId: null, assignedAt: null, startedAt: null }).where(eq(orders.id, orderId));
          await tx.update(orderResponses).set({ status: "withdrawn" }).where(and(eq(orderResponses.orderId, orderId), eq(orderResponses.providerId, p!.id)));
          await tx.update(orderResponses).set({ status: "pending" }).where(and(eq(orderResponses.orderId, orderId), eq(orderResponses.status, "declined")));
          await logOrderEvent(tx, orderId, user.id, "provider_withdrew", { reason: a.reason ?? null });
        });
        await notify(order.clientId, { type: "order.status", title: "Исполнитель отказался от заказа", body: "Заявка снова открыта — выберите другого исполнителя из откликов.", link: `/orders/${orderId}` });
      } else throw forbidden();
      break;
    }
  }
  const [updated] = await db.select().from(orders).where(eq(orders.id, orderId));
  return updated;
}

export type OrderListItem = Order & { subName: string; icon: string; tone: string; responsesCount: number; providerName: string | null; providerSlug: string | null; providerAvatar: string | null; hasReview: boolean; districtName: string | null; clientName: string };

const listColumns = {
  order: orders,
  subName: subcategories.name,
  icon: subcategories.icon,
  tone: categories.tone,
  providerName: providers.displayName,
  providerSlug: providers.slug,
  providerAvatar: providers.avatarUrl,
  districtName: districts.name,
  clientName: sql<string>`(select split_part(u.name, ' ', 1) from users u where u.id = ${orders.clientId})`,
  responsesCount: sql<number>`(select count(*)::int from ${orderResponses} r where r.order_id = ${orders.id} and r.status <> 'withdrawn')`,
  hasReview: sql<boolean>`exists (select 1 from ${reviews} rv where rv.order_id = ${orders.id})`,
};

function flatten(rows: { order: Order; subName: string; icon: string; tone: string; providerName: string | null; providerSlug: string | null; providerAvatar: string | null; districtName: string | null; clientName: string; responsesCount: number; hasReview: boolean }[]): OrderListItem[] {
  return rows.map(({ order, ...rest }) => ({ ...order, ...rest }));
}

function listQuery() {
  return db
    .select(listColumns)
    .from(orders)
    .innerJoin(subcategories, eq(subcategories.id, orders.subcategoryId))
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .leftJoin(providers, eq(providers.id, orders.providerId))
    .leftJoin(districts, eq(districts.id, orders.districtId));
}

export async function listClientOrders(userId: string) {
  return flatten(await listQuery().where(eq(orders.clientId, userId)).orderBy(desc(orders.createdAt)).limit(100));
}

/** Open requests a provider can respond to. */
export async function providerFeed(providerId: string, limit = 50) {
  const [p] = await db.select().from(providers).where(eq(providers.id, providerId));
  if (!p) return [];
  const subIds = (await db.select({ id: providerSubcategories.subcategoryId }).from(providerSubcategories).where(eq(providerSubcategories.providerId, providerId))).map((r) => r.id);
  const allSubs = [...new Set([p.primarySubcategoryId, ...subIds])];
  const dist =
    p.lat != null && p.lng != null
      ? sql<number | null>`(6371 * 2 * asin(sqrt(power(sin(radians(${orders.lat} - ${p.lat}) / 2), 2) + cos(radians(${p.lat})) * cos(radians(${orders.lat})) * power(sin(radians(${orders.lng} - ${p.lng}) / 2), 2))))`
      : sql<number | null>`null::float`;
  const rows = await db
    .select({ ...listColumns, distanceKm: dist, responded: sql<boolean>`exists (select 1 from ${orderResponses} r2 where r2.order_id = ${orders.id} and r2.provider_id = ${providerId})` })
    .from(orders)
    .innerJoin(subcategories, eq(subcategories.id, orders.subcategoryId))
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .leftJoin(providers, eq(providers.id, orders.providerId))
    .leftJoin(districts, eq(districts.id, orders.districtId))
    .where(
      and(
        eq(orders.cityId, p.cityId),
        inArray(orders.subcategoryId, allSubs),
        inArray(orders.status, [...OPEN_STATUSES]),
        or(isNull(orders.directProviderId), eq(orders.directProviderId, providerId)),
        ne(orders.clientId, p.userId),
        sql`not exists (select 1 from ${orderDismissals} d where d.order_id = ${orders.id} and d.provider_id = ${providerId})`,
      ),
    )
    .orderBy(sql`case ${orders.urgency} when 'urgent' then 0 when 'today' then 1 else 2 end`, desc(orders.createdAt))
    .limit(limit);
  return rows.map(({ order, distanceKm, responded, ...rest }) => ({
    ...order,
    ...rest,
    address: maskAddress(order.address),
    distanceKm: distanceKm == null ? null : Math.round(Number(distanceKm) * 10) / 10,
    responded,
    isDirect: order.directProviderId === providerId,
  }));
}

export async function providerOrders(providerId: string) {
  return flatten(await listQuery().where(eq(orders.providerId, providerId)).orderBy(desc(orders.createdAt)).limit(100));
}

export async function providerResponses(providerId: string) {
  const rows = await db
    .select({ response: orderResponses, orderTitle: orders.title, orderStatus: orders.status, orderId: orders.id, orderProviderId: orders.providerId })
    .from(orderResponses)
    .innerJoin(orders, eq(orders.id, orderResponses.orderId))
    .where(eq(orderResponses.providerId, providerId))
    .orderBy(desc(orderResponses.createdAt))
    .limit(100);
  return rows;
}

export async function leaveReview(user: CurrentUser, orderId: string, input: { rating: number; text: string; photos: string[] }) {
  const { order, role } = await orderAccess(orderId, user);
  if (role !== "client") throw forbidden("Отзыв может оставить только заказчик");
  if (order.status !== "completed" || !order.providerId) throw conflict("Отзыв можно оставить после завершения заказа");
  const [exists] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.orderId, orderId));
  if (exists) throw conflict("Вы уже оставили отзыв");
  const [r] = await db.insert(reviews).values({ orderId, providerId: order.providerId, authorId: user.id, rating: input.rating, text: input.text, photos: input.photos }).returning();
  await logOrderEvent(db, orderId, user.id, "reviewed", { rating: input.rating });
  await recomputeProviderStats(db, order.providerId);
  const [pu] = await db.select({ userId: providers.userId, slug: providers.slug }).from(providers).where(eq(providers.id, order.providerId));
  await notify(pu.userId, { type: "review.new", title: `Новый отзыв: ${"★".repeat(input.rating)}`, body: input.text.slice(0, 140) || `Оценка ${input.rating} из 5`, link: `/provider/${pu.slug}#reviews` });
  return r;
}

export async function replyToReview(user: CurrentUser, reviewId: string, reply: string) {
  if (!user.provider) throw forbidden();
  const [r] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!r || r.providerId !== user.provider.id) throw notFound();
  if (r.reply) throw conflict("Вы уже ответили на этот отзыв");
  await db.update(reviews).set({ reply: reply.slice(0, 1000) }).where(eq(reviews.id, reviewId));
}

/** «Не интересно»: hides an open order from this provider's feed. Idempotent. */
export async function dismissOrder(providerId: string, orderId: string) {
  const [o] = await db.select({ id: orders.id, title: orders.title }).from(orders).where(eq(orders.id, orderId));
  if (!o) throw notFound();
  await db.insert(orderDismissals).values({ providerId, orderId }).onConflictDoNothing();
  return o;
}
