import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { PLANS, PROMOTIONS, STAR_PLANS, getProduct, parseChannels, type Channel, type PlanId, type Product, type PromotionId, type StarPlanId } from "@/config/monetization";
import { db, type DbOrTx } from "../db";
import { invoices, promoCodes, promotions, providers, subscriptions, users, type Invoice } from "../db/schema";
import { env } from "../env";
import { badRequest, conflict, forbidden, notFound } from "../http/errors";
import { notify } from "../notifications/notify";
import { createStarsInvoiceLink } from "../telegram/bot";
import { log } from "../log";
import type { CurrentUser } from "../auth/session";

/*
 * Optional platform monetisation (docs/MONETIZATION.md).
 *
 * Invariants:
 *  - nothing in orders / responses / chat / reviews / profile editing calls into this module;
 *  - with MONETIZATION_CHANNELS empty every perk resolves to false and no offer is shown;
 *  - no acquiring for client ↔ provider money. A RUB invoice is a request that an admin activates after
 *    an off-platform payment; an XTR invoice is a Telegram Stars checkout activated by the bot's
 *    successful_payment update (the webhook is authenticated by its secret token).
 */

/** Read on every call so the switch applies without a rebuild (and can be flipped in tests). */
const enabled = () => parseChannels(process.env.MONETIZATION_CHANNELS ?? env.MONETIZATION_CHANNELS);

export function channelOn(c: Channel) {
  return enabled().has(c);
}
export function anyChannelOn() {
  return enabled().size > 0;
}
export function enabledChannels(): Channel[] {
  return [...enabled()];
}

type PerkSource = { proUntil: Date | null; boostedUntil: Date | null; highlightedUntil: Date | null; promoUntil?: Date | null };

const live = (d: Date | null, now: number) => !!d && d.getTime() > now;

/** Paid perks currently in effect. A switched-off channel neutralises its perks immediately. */
export function perks(p: PerkSource, now = Date.now()) {
  return {
    pro: channelOn("pro") && live(p.proUntil, now),
    /** «Продвижение» subscription: instant Telegram cards about new orders nearby (nothing else). */
    promo: channelOn("promotion") && live(p.promoUntil ?? null, now),
    boosted: channelOn("promotion") && live(p.boostedUntil, now),
    highlighted: channelOn("promotion") && live(p.highlightedUntil, now),
  };
}

/**
 * Whether a provider gets the instant Telegram card about a new order nearby. With the promotion channel
 * off everyone does (fully free mode); with it on, only «Продвижение» subscribers. Everyone else still
 * sees the order in the in-app feed and in-app notifications and can respond to it for free.
 */
export function instantOrderCards(p: { promoUntil: Date | null }, now = Date.now()) {
  return !channelOn("promotion") || live(p.promoUntil, now);
}

/** Paid offers visible to providers (only for enabled channels). */
export function offers(): Product[] {
  return [...Object.keys(STAR_PLANS), ...Object.keys(PLANS)].map((id) => getProduct(id)!).filter((p) => channelOn(p.channel));
}

export async function resolvePromo(code: string | undefined) {
  if (!code) return null;
  const [pc] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase().trim()));
  if (!pc || !pc.isActive) throw badRequest("Промокод не найден");
  if (pc.validUntil && pc.validUntil.getTime() < Date.now()) throw badRequest("Срок действия промокода истёк");
  if (pc.maxUses != null && pc.usedCount >= pc.maxUses) throw badRequest("Промокод больше не действует");
  return pc;
}

/** Provider asks for a paid service. Creates an invoice request; nothing is charged here. */
export async function requestService(user: CurrentUser, productId: string, promoCode?: string) {
  if (!user.provider) throw forbidden("Доступно исполнителям");
  if (user.provider.status !== "active") throw forbidden("Платные услуги доступны после модерации профиля");
  const product = getProduct(productId);
  if (!product || !channelOn(product.channel)) throw notFound("Услуга недоступна");
  if (product.currency === "XTR") throw badRequest("Эта услуга оплачивается звёздами в Telegram");
  const [open] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.providerId, user.provider.id), eq(invoices.productId, product.id), eq(invoices.status, "requested")));
  if (open) throw conflict("Заявка на эту услугу уже создана — дождитесь счёта");
  const promo = await resolvePromo(promoCode);
  const discount = promo ? Math.round((product.price * promo.discountPct) / 100) : 0;
  const [inv] = await db
    .insert(invoices)
    .values({ userId: user.id, providerId: user.provider.id, productId: product.id, amount: product.price, discount, promoCodeId: promo?.id ?? null })
    .returning();
  if (product.price - discount <= 0) return activate(inv.id, null);
  const staff = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  for (const s of staff) await notify(s.id, { type: "billing", title: "Новая заявка на платную услугу", body: `${product.title} — ${user.provider.displayName}, ${product.price - discount} ₽`, link: "/admin/billing" });
  return inv;
}

/** Grants a product to a provider (inside a transaction). invoiceId = null for a free admin grant. */
async function applyProduct(tx: DbOrTx, providerId: string, productId: string, invoiceId: string | null) {
  const [prov] = await tx.select().from(providers).where(eq(providers.id, providerId)).for("update");
  if (!prov) throw notFound();
  const now = new Date();
  const extend = (current: Date | null, ms: number) => new Date(Math.max(now.getTime(), current?.getTime() ?? 0) + ms);
  if (productId in STAR_PLANS) {
    const plan = STAR_PLANS[productId as StarPlanId];
    const endsAt = extend(prov.promoUntil, plan.periodDays * 86400000);
    await tx.update(providers).set({ promoUntil: endsAt }).where(eq(providers.id, prov.id));
    await tx.insert(subscriptions).values({ providerId: prov.id, plan: plan.id, invoiceId, startsAt: now, endsAt });
  } else if (productId in PLANS) {
    const plan = PLANS[productId as PlanId];
    const endsAt = extend(prov.proUntil, plan.periodDays * 86400000);
    // PRO is a paid badge only; it never changes the moderation/verification level.
    await tx.update(providers).set({ proUntil: endsAt }).where(eq(providers.id, prov.id));
    await tx.insert(subscriptions).values({ providerId: prov.id, plan: plan.id, invoiceId, startsAt: now, endsAt });
  } else if (productId in PROMOTIONS) {
    const promo = PROMOTIONS[productId as PromotionId];
    const isHighlight = productId.startsWith("highlight");
    const endsAt = extend(isHighlight ? prov.highlightedUntil : prov.boostedUntil, promo.hours * 3600000);
    await tx.update(providers).set(isHighlight ? { highlightedUntil: endsAt } : { boostedUntil: endsAt }).where(eq(providers.id, prov.id));
    await tx.insert(promotions).values({ providerId: prov.id, kind: productId, invoiceId, startsAt: now, endsAt });
  } else throw badRequest("Неизвестная услуга");
  return prov;
}

/** Admin confirms that the invoice was paid (off-platform) and activates the service. Idempotent. */
export async function activate(invoiceId: string, adminId: string | null, telegramChargeId: string | null = null): Promise<Invoice> {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
    if (!inv) throw notFound();
    if (inv.status === "activated") return inv;
    // money already received in Stars wins over a cancellation made meanwhile
    if (inv.status !== "requested" && !telegramChargeId) throw conflict("Заявка уже закрыта");
    const prov = await applyProduct(tx, inv.providerId, inv.productId, inv.id);
    const [done] = await tx.update(invoices).set({ status: "activated", activatedAt: new Date(), activatedBy: adminId, telegramChargeId }).where(eq(invoices.id, inv.id)).returning();
    if (inv.promoCodeId) await tx.update(promoCodes).set({ usedCount: sql`${promoCodes.usedCount} + 1` }).where(eq(promoCodes.id, inv.promoCodeId));
    await notify(prov.userId, { type: "billing", title: "Услуга подключена", body: getProduct(inv.productId)?.title ?? inv.productId, link: "/pro/billing" }, tx);
    return done;
  });
}

/** Cancels an open request (by its provider or by an admin). */
export async function cancelInvoice(user: CurrentUser, invoiceId: string, note?: string) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw notFound();
  const isStaff = user.role !== "user";
  if (!isStaff && inv.userId !== user.id) throw notFound();
  if (inv.status !== "requested") throw conflict("Заявка уже закрыта");
  await db.update(invoices).set({ status: "cancelled", note: note ?? null }).where(eq(invoices.id, inv.id));
  if (isStaff && inv.userId !== user.id) await notify(inv.userId, { type: "billing", title: "Заявка на услугу отменена", body: note || (getProduct(inv.productId)?.title ?? ""), link: "/pro/billing" });
}

/** Free grant by an admin (trial, partner, compensation). No invoice is created. */
export async function grant(providerId: string, productId: string) {
  const product = getProduct(productId);
  if (!product) throw badRequest("Неизвестная услуга");
  return db.transaction(async (tx) => {
    const prov = await applyProduct(tx, providerId, productId, null);
    await notify(prov.userId, { type: "billing", title: "Вам подключена услуга", body: `${product.title} — бесплатно`, link: "/pro/billing" }, tx);
    return prov;
  });
}

export async function providerInvoices(providerId: string, limit = 30) {
  return db.select().from(invoices).where(eq(invoices.providerId, providerId)).orderBy(desc(invoices.createdAt)).limit(limit);
}

/* ---------------------------------------------------------------- Telegram Stars */

const STARS_PAYLOAD = "inv:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseStarsPayload(payload: string) {
  const id = payload.startsWith(STARS_PAYLOAD) ? payload.slice(STARS_PAYLOAD.length) : "";
  return UUID.test(id) ? id : null;
}

/** Creates (or reuses) an unpaid XTR invoice and returns a Telegram Stars payment link for it. */
export async function startStarsCheckout(user: CurrentUser, productId: string) {
  if (!user.provider) throw forbidden("Доступно исполнителям");
  if (user.provider.status !== "active") throw forbidden("Продвижение доступно после модерации профиля");
  if (!user.telegramId) throw badRequest("Оплата звёздами проходит в Telegram. Войдите через Telegram или привяжите его в настройках.");
  const product = getProduct(productId);
  if (!product || product.currency !== "XTR" || !channelOn(product.channel)) throw notFound("Услуга недоступна");
  const [open] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.providerId, user.provider.id), eq(invoices.productId, product.id), eq(invoices.status, "requested"), eq(invoices.currency, "XTR"), sql`${invoices.createdAt} > now() - interval '1 day'`))
    .limit(1);
  const inv = open ?? (await db.insert(invoices).values({ userId: user.id, providerId: user.provider.id, productId: product.id, amount: product.price, currency: "XTR" }).returning())[0];
  const link = await createStarsInvoiceLink({ title: product.title, description: product.description.slice(0, 255), payload: `${STARS_PAYLOAD}${inv.id}`, stars: inv.amount - inv.discount });
  if (!link) throw badRequest("Оплата звёздами сейчас недоступна");
  return { invoiceId: inv.id, link };
}

type StarsPayment = { fromTelegramId: number; currency: string; totalAmount: number; payload: string };

/** Loads the invoice a Stars payment refers to and checks that it is exactly what we issued, to this payer. */
async function checkStarsPayment(p: StarsPayment) {
  const id = parseStarsPayload(p.payload);
  if (!id) return { error: "Счёт не найден" } as const;
  const [row] = await db
    .select({ inv: invoices, telegramId: users.telegramId, providerStatus: providers.status })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .innerJoin(providers, eq(providers.id, invoices.providerId))
    .where(eq(invoices.id, id));
  if (!row || row.inv.currency !== "XTR") return { error: "Счёт не найден" } as const;
  if (row.telegramId !== String(p.fromTelegramId)) return { error: "Этот счёт выставлен другому аккаунту" } as const;
  if (p.currency !== "XTR" || p.totalAmount !== row.inv.amount - row.inv.discount) return { error: "Сумма не совпадает со счётом" } as const;
  return { inv: row.inv, providerStatus: row.providerStatus } as const;
}

/** pre_checkout_query: the last chance to refuse before Telegram takes the Stars. Returns an error text or null. */
export async function starsPreCheckoutError(p: StarsPayment): Promise<string | null> {
  const r = await checkStarsPayment(p);
  if ("error" in r) return r.error ?? "Счёт не найден";
  if (r.inv.status !== "requested") return "Счёт уже оплачен или отменён. Откройте «Продвижение» и попробуйте снова.";
  const product = getProduct(r.inv.productId);
  if (!product || !channelOn(product.channel)) return "Услуга сейчас недоступна";
  if (r.providerStatus !== "active") return "Профиль исполнителя не активен";
  return null;
}

/** successful_payment: the Stars are ours — activate. Idempotent (Telegram may redeliver the update). */
export async function completeStarsPayment(p: StarsPayment & { chargeId: string }) {
  const r = await checkStarsPayment(p);
  if ("error" in r) {
    // should never happen after a passed pre-checkout; keep the charge id for a manual refund
    log.error("stars payment does not match an invoice", { payload: p.payload, chargeId: p.chargeId, error: r.error });
    return null;
  }
  return activate(r.inv.id, null, p.chargeId);
}
