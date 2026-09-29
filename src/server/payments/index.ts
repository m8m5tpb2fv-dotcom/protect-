import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { PLANS, PROMOTIONS, type PlanId, type PromotionId } from "@/config/app";
import { db } from "../db";
import { payments, promoCodes, promotions, providers, subscriptions, type Payment } from "../db/schema";
import { env } from "../env";
import { AppError, badRequest, forbidden, notFound } from "../http/errors";
import { log } from "../log";
import { notify } from "../notifications/notify";
import type { CurrentUser } from "../auth/session";

/* ───────── gateway abstraction ───────── */

export interface PaymentGateway {
  id: "sandbox" | "yookassa";
  isTest: boolean;
  create(p: Payment, opts: { description: string; returnUrl: string }): Promise<{ externalId: string; confirmationUrl: string }>;
  /** Fetches the authoritative status from the provider (never trust webhook bodies). */
  fetchStatus(externalId: string): Promise<"pending" | "succeeded" | "cancelled" | "failed">;
}

const sandbox: PaymentGateway = {
  id: "sandbox",
  isTest: true,
  async create(p) {
    return { externalId: `sbx_${randomUUID()}`, confirmationUrl: `/pay/sandbox/${p.id}` };
  },
  async fetchStatus() {
    return "pending";
  },
};

const yookassa: PaymentGateway = {
  id: "yookassa",
  isTest: env.YOOKASSA_SECRET_KEY.startsWith("test_"),
  async create(p, { description, returnUrl }) {
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString("base64"),
        "content-type": "application/json",
        "idempotence-key": p.id,
      },
      body: JSON.stringify({
        amount: { value: (p.amount - p.discount).toFixed(2), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: returnUrl },
        description: description.slice(0, 128),
        metadata: { paymentId: p.id },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json()) as { id?: string; confirmation?: { confirmation_url?: string }; description?: string };
    if (!res.ok || !json.id || !json.confirmation?.confirmation_url) throw new AppError(502, "payment_gateway", "Платёжный сервис недоступен. Попробуйте позже.");
    return { externalId: json.id, confirmationUrl: json.confirmation.confirmation_url };
  },
  async fetchStatus(externalId) {
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(externalId)}`, {
      headers: { authorization: "Basic " + Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString("base64") },
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json()) as { status?: string };
    if (json.status === "succeeded") return "succeeded";
    if (json.status === "canceled") return "cancelled";
    return "pending";
  },
};

export function gateway(): PaymentGateway {
  if (env.PAYMENT_GATEWAY === "yookassa" && env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY) return yookassa;
  return sandbox;
}

/* ───────── products ───────── */

export type Product = { id: string; title: string; description: string; price: number; purpose: "subscription" | "promotion" };
export function getProduct(id: string): Product | null {
  if (id in PLANS) {
    const p = PLANS[id as PlanId];
    return { id, title: p.title, description: p.description, price: p.price, purpose: "subscription" };
  }
  if (id in PROMOTIONS) {
    const p = PROMOTIONS[id as PromotionId];
    return { id, title: p.title, description: p.description, price: p.price, purpose: "promotion" };
  }
  return null;
}

export async function resolvePromo(code: string | undefined) {
  if (!code) return null;
  const [pc] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
  if (!pc || !pc.isActive) throw badRequest("Промокод не найден");
  if (pc.validUntil && pc.validUntil.getTime() < Date.now()) throw badRequest("Срок действия промокода истёк");
  if (pc.maxUses != null && pc.usedCount >= pc.maxUses) throw badRequest("Промокод больше не действует");
  return pc;
}

export async function checkout(user: CurrentUser, productId: string, promoCode?: string) {
  if (!user.provider) throw forbidden("Доступно исполнителям");
  if (user.provider.status !== "active") throw forbidden("Продвижение доступно после модерации профиля");
  const product = getProduct(productId);
  if (!product) throw notFound("Тариф не найден");
  const promo = await resolvePromo(promoCode);
  const discount = promo ? Math.round((product.price * promo.discountPct) / 100) : 0;
  const gw = gateway();
  const [p] = await db
    .insert(payments)
    .values({ userId: user.id, providerId: user.provider.id, gateway: gw.id, isTest: gw.isTest, purpose: product.purpose, productId, amount: product.price, discount, promoCodeId: promo?.id ?? null })
    .returning();
  if (product.price - discount <= 0) {
    await fulfil(p.id);
    return { paymentId: p.id, confirmationUrl: `/pro/billing?paid=${p.id}` };
  }
  try {
    const { externalId, confirmationUrl } = await gw.create(p, { description: `${product.title} — ${user.provider.displayName}`, returnUrl: `${env.APP_URL}/pro/billing?paid=${p.id}` });
    await db.update(payments).set({ externalId }).where(eq(payments.id, p.id));
    return { paymentId: p.id, confirmationUrl };
  } catch (e) {
    await db.update(payments).set({ status: "failed", failureReason: e instanceof Error ? e.message : "gateway error" }).where(eq(payments.id, p.id));
    throw e;
  }
}

/** Idempotently marks a payment as paid and grants the product. */
export async function fulfil(paymentId: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p) throw notFound();
    if (p.status === "succeeded") return p;
    if (p.status !== "pending") throw badRequest("Платёж уже закрыт");
    const now = new Date();
    await tx.update(payments).set({ status: "succeeded", paidAt: now }).where(eq(payments.id, p.id));
    if (p.promoCodeId) await tx.update(promoCodes).set({ usedCount: sql`${promoCodes.usedCount} + 1` }).where(eq(promoCodes.id, p.promoCodeId));
    if (!p.providerId) return p;
    const [prov] = await tx.select().from(providers).where(eq(providers.id, p.providerId));
    const extend = (current: Date | null, ms: number) => new Date(Math.max(now.getTime(), current?.getTime() ?? 0) + ms);
    if (p.productId in PLANS) {
      const plan = PLANS[p.productId as PlanId];
      const endsAt = extend(prov.proUntil, plan.periodDays * 86400000);
      await tx.update(providers).set({ proUntil: endsAt, verification: prov.verification === "none" || prov.verification === "verified" ? "pro" : prov.verification }).where(eq(providers.id, prov.id));
      await tx.insert(subscriptions).values({ providerId: prov.id, plan: plan.id, paymentId: p.id, startsAt: now, endsAt });
    } else if (p.productId in PROMOTIONS) {
      const promo = PROMOTIONS[p.productId as PromotionId];
      const ms = promo.hours * 3600000;
      const isHighlight = p.productId.startsWith("highlight");
      const endsAt = extend(isHighlight ? prov.highlightedUntil : prov.boostedUntil, ms);
      await tx.update(providers).set(isHighlight ? { highlightedUntil: endsAt } : { boostedUntil: endsAt }).where(eq(providers.id, prov.id));
      await tx.insert(promotions).values({ providerId: prov.id, kind: p.productId, paymentId: p.id, startsAt: now, endsAt });
    }
    await notify(p.userId, { type: "payment", title: "Оплата прошла", body: `${getProduct(p.productId)?.title ?? p.productId}${p.isTest ? " (тестовый платёж)" : ""}`, link: "/pro/billing" }, tx);
    return p;
  });
}

export async function failPayment(paymentId: string, reason: string) {
  await db.update(payments).set({ status: "failed", failureReason: reason }).where(and(eq(payments.id, paymentId), eq(payments.status, "pending")));
}

/** Sandbox confirmation page action. Only works while the sandbox gateway is active. */
export async function sandboxComplete(user: CurrentUser, paymentId: string, outcome: "success" | "fail") {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || p.userId !== user.id) throw notFound();
  if (p.gateway !== "sandbox") throw forbidden("Это не тестовый платёж");
  if (outcome === "fail") {
    await failPayment(p.id, "Отклонено в тестовом режиме");
    return { status: "failed" as const };
  }
  await fulfil(p.id);
  return { status: "succeeded" as const };
}

export async function handleYookassaWebhook(body: unknown) {
  const obj = (body as { object?: { id?: string; metadata?: { paymentId?: string } } })?.object;
  if (!obj?.id) throw badRequest();
  const [p] = await db.select().from(payments).where(and(eq(payments.gateway, "yookassa"), eq(payments.externalId, obj.id)));
  if (!p) {
    log.warn("yookassa webhook for unknown payment", { id: obj.id });
    return;
  }
  const status = await yookassa.fetchStatus(obj.id);
  if (status === "succeeded") await fulfil(p.id);
  else if (status === "cancelled") await failPayment(p.id, "Отменён платёжной системой");
}
