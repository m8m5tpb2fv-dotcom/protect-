import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { PLANS, PROMOTIONS, getProduct, parseChannels, type Channel, type PlanId, type Product, type PromotionId } from "@/config/monetization";
import { db, type DbOrTx } from "../db";
import { invoices, promoCodes, promotions, providers, subscriptions, users, type Invoice } from "../db/schema";
import { env } from "../env";
import { badRequest, conflict, forbidden, notFound } from "../http/errors";
import { notify } from "../notifications/notify";
import type { CurrentUser } from "../auth/session";

/*
 * Optional platform monetisation (docs/MONETIZATION.md).
 *
 * Invariants:
 *  - nothing in orders / responses / chat / reviews / profile editing calls into this module;
 *  - with MONETIZATION_CHANNELS empty every perk resolves to false and no offer is shown;
 *  - no acquiring: an invoice is a request that an admin activates after an off-platform payment.
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

type PerkSource = { proUntil: Date | null; boostedUntil: Date | null; highlightedUntil: Date | null };

/** Paid perks currently in effect. A switched-off channel neutralises its perks immediately. */
export function perks(p: PerkSource, now = Date.now()) {
  const live = (d: Date | null) => !!d && d.getTime() > now;
  return {
    pro: channelOn("pro") && live(p.proUntil),
    boosted: channelOn("promotion") && live(p.boostedUntil),
    highlighted: channelOn("promotion") && live(p.highlightedUntil),
  };
}

/** Paid offers visible to providers (only for enabled channels). */
export function offers(): Product[] {
  return [...Object.keys(PLANS), ...Object.keys(PROMOTIONS)].map((id) => getProduct(id)!).filter((p) => channelOn(p.channel));
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
  if (productId in PLANS) {
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
export async function activate(invoiceId: string, adminId: string | null): Promise<Invoice> {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
    if (!inv) throw notFound();
    if (inv.status === "activated") return inv;
    if (inv.status !== "requested") throw conflict("Заявка уже закрыта");
    const prov = await applyProduct(tx, inv.providerId, inv.productId, inv.id);
    const [done] = await tx.update(invoices).set({ status: "activated", activatedAt: new Date(), activatedBy: adminId }).where(eq(invoices.id, inv.id)).returning();
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
