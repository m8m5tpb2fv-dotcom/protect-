/**
 * Integration tests against a real PostgreSQL (ryadom_test).
 * Cover the critical marketplace flow, permissions, auth and the zero-commission / optional monetisation model.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "@/server/db/schema";
import { db } from "@/server/db";
import { seedReference } from "@/server/db/seed";
import { createSession, userFromToken, type CurrentUser } from "@/server/auth/session";
import { loginWithEmail, loginWithTelegram, registerWithEmail, requestPhoneCode, verifyPhoneCode } from "@/server/auth/service";
import { signInitData } from "@/server/telegram/init-data";
import { createOrder, dismissOrder, getOrderDetail, leaveReview, listClientOrders, orderAction, providerFeed, respondToOrder } from "@/server/services/orders";
import { handleUpdate } from "@/server/telegram/handlers";
import { demoSummary, purgeDemo } from "@/server/services/demo";
import { decryptBackup, lastBackup, runBackup } from "@/server/backup";
import { createProviderProfile } from "@/server/services/provider-self";
import { listMessages, sendChatMessage, startConversation } from "@/server/services/chat";
import { searchProviders } from "@/server/services/providers";
import { runAdminAction } from "@/server/services/admin";
import { activate, cancelInvoice, completeStarsPayment, instantOrderCards, perks, requestService, starsPreCheckoutError, startStarsCheckout } from "@/server/billing";
import { claimTelegramLogin, confirmTelegramLogin, findPendingLogin, parseLoginStartParam, loginStartParam, rejectTelegramLogin, startTelegramLogin } from "@/server/auth/telegram-login";
import { adClick, pickAd } from "@/server/services/ads";
import { AppError } from "@/server/http/errors";
import { resetRateLimits } from "@/server/http/rate-limit";

let cityId: number;
let santehnikId: number;

async function asUser(userId: string): Promise<CurrentUser> {
  const { token } = await createSession(userId, "email");
  return (await userFromToken(token))!;
}

async function expectAppError(p: Promise<unknown>, status: number) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).status).toBe(status);
    return;
  }
  throw new Error(`expected AppError ${status}`);
}

let client: CurrentUser, stranger: CurrentUser, provider: CurrentUser, admin: CurrentUser;

beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await seedReference(drizzle(pool, { schema: s }));
  await pool.end();
  const [c] = await db.select().from(s.cities).where(eq(s.cities.slug, "saratov"));
  cityId = c.id;
  const [sub] = await db.select().from(s.subcategories).where(eq(s.subcategories.slug, "santehnik"));
  santehnikId = sub.id;
  resetRateLimits();

  const u1 = await registerWithEmail({ name: "Клиент Тест", email: "client@test.local", password: "password-123" });
  const u2 = await registerWithEmail({ name: "Посторонний", email: "stranger@test.local", password: "password-123" });
  const u3 = await registerWithEmail({ name: "Мастер Тест", email: "master@test.local", password: "password-123" });
  const u4 = await registerWithEmail({ name: "Админ", email: "admin@test.local", password: "password-123" });
  await db.update(s.users).set({ role: "admin" }).where(eq(s.users.id, u4.id));
  client = await asUser(u1.id);
  stranger = await asUser(u2.id);
  admin = await asUser(u4.id);

  // Scenario B: provider registers → pending → admin approves
  const pre = await asUser(u3.id);
  const [district] = await db.select().from(s.districts).limit(1);
  const p = await createProviderProfile(pre, { displayName: "Мастер Тест", kind: "person", headline: "Сантехник, устраняю протечки", bio: "", primarySubcategoryId: santehnikId, subcategoryIds: [], districtId: district.id, radiusKm: 15, worksCityWide: true, experienceYears: 5, priceFrom: 900, phone: "+79001112233", telegram: "@master", showPhone: true, avatarUrl: null, coverUrl: null, schedule: null }, cityId);
  expect(p.status).toBe("pending");
  await runAdminAction(admin, { type: "provider.approve", id: p.id });
  provider = await asUser(u3.id);
  expect(provider.provider?.status).toBe("active");
});

describe("auth", () => {
  it("email login / wrong password", async () => {
    const u = await loginWithEmail({ email: "client@test.local", password: "password-123" }, "t1");
    expect(u.id).toBe(client.id);
    await expectAppError(loginWithEmail({ email: "client@test.local", password: "nope-nope" }, "t1"), 401);
  });
  it("duplicate email", async () => {
    await expectAppError(registerWithEmail({ name: "X", email: "CLIENT@test.local", password: "password-123" }), 409);
  });
  it("phone OTP", async () => {
    const r = await requestPhoneCode("+7 900 555-44-33", "t2");
    expect(r.devCode).toMatch(/^\d{6}$/);
    await expectAppError(verifyPhoneCode({ phone: "+79005554433", code: r.devCode === "000000" ? "111111" : "000000" }), 400);
    const ok = await verifyPhoneCode({ phone: "89005554433", code: r.devCode!, name: "Ольга" });
    expect(ok.isNew).toBe(true);
    expect(ok.user.phone).toBe("+79005554433");
  });
  it("telegram auto-auth creates then reuses the account; forged data rejected", async () => {
    const data = signInitData({ user: JSON.stringify({ id: 777, first_name: "Тг", username: "tguser" }), auth_date: String(Math.floor(Date.now() / 1000)) }, process.env.TELEGRAM_BOT_TOKEN!);
    const a = await loginWithTelegram(data);
    const b = await loginWithTelegram(data);
    expect(a.isNew).toBe(true);
    expect(b.user.id).toBe(a.user.id);
    await expectAppError(loginWithTelegram(data.replace("tguser", "hacker")), 401);
  });
  it("sessions: invalid token → null; blocked user → null", async () => {
    expect(await userFromToken("garbage")).toBeNull();
    const { token } = await createSession(stranger.id, "email");
    await db.update(s.users).set({ isBlocked: true }).where(eq(s.users.id, stranger.id));
    expect(await userFromToken(token)).toBeNull();
    await db.update(s.users).set({ isBlocked: false }).where(eq(s.users.id, stranger.id));
  });
});

describe("Scenario A: client → order → response → chat → complete → review", () => {
  let orderId: string;

  it("search finds the provider by free text", async () => {
    const r = await searchProviders(cityId, { q: "течет труба под раковиной" });
    expect(r.items.some((p) => p.id === provider.provider!.id)).toBe(true);
    expect(r.matched.subs.some((x) => x.id === santehnikId) || r.matched.services.length > 0).toBe(true);
  });

  it("client creates an order; matching provider is notified", async () => {
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Устранить протечку", description: "Протекает труба под раковиной", address: "Саратов, ул. Московская, 1, кв. 5", urgency: "today", photos: [] }, cityId);
    orderId = o.id;
    expect(o.status).toBe("new");
    const notes = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, provider.id), eq(s.notifications.type, "order.new")));
    expect(notes.length).toBeGreaterThan(0);
  });

  it("strangers cannot see the order; prospect provider sees masked address", async () => {
    await expectAppError(getOrderDetail(orderId, stranger), 403);
    const d = await getOrderDetail(orderId, provider);
    expect(d.role).toBe("prospect");
    expect(d.order.address).not.toContain("кв. 5");
    expect(d.client.phone).toBeNull();
  });

  it("provider responds (once); client is notified; chat is opened", async () => {
    const r = await respondToOrder(provider, orderId, { message: "Приеду сегодня в 18:00", price: 1200, eta: "Сегодня" });
    await expectAppError(respondToOrder(provider, orderId, { message: "ещё раз", price: 1 }), 409);
    await expectAppError(respondToOrder(client, orderId, { message: "сам себе", price: 1 }), 403);
    const notes = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, client.id), eq(s.notifications.type, "order.response")));
    expect(notes.length).toBe(1);
    const msgs = await listMessages(r.conversationId, client);
    expect(msgs[0].body).toContain("Приеду сегодня");
  });

  it("only participants can use the chat", async () => {
    const convId = await startConversation(client, provider.provider!.id, orderId);
    const m = await sendChatMessage(convId, client, { body: "Жду!", attachments: [] });
    expect(m.body).toBe("Жду!");
    await expectAppError(listMessages(convId, stranger), 403);
    await expectAppError(sendChatMessage(convId, stranger, { body: "spam", attachments: [] }), 403);
    await listMessages(convId, provider);
    const [read] = await db.select().from(s.messages).where(eq(s.messages.id, m.id));
    expect(read.readAt).not.toBeNull();
  });

  it("client chooses; only assigned provider can start; completion takes no commission", async () => {
    const d = await getOrderDetail(orderId, client);
    await expectAppError(orderAction(stranger, orderId, { action: "choose", responseId: d.responses[0].id }), 403);
    await orderAction(client, orderId, { action: "choose", responseId: d.responses[0].id });
    const afterChoose = await getOrderDetail(orderId, provider);
    expect(afterChoose.role).toBe("provider");
    expect(afterChoose.order.address).toContain("кв. 5");
    await expectAppError(orderAction(client, orderId, { action: "start" }), 403);
    await orderAction(provider, orderId, { action: "start" });
    await orderAction(provider, orderId, { action: "complete", finalPrice: 1500 });
    const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId));
    expect(o.status).toBe("completed");
    expect(o.agreedPrice).toBe(1500); // informational only — paid to the provider directly
    expect(o).not.toHaveProperty("commissionAmount");
    const [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.ordersCompleted).toBe(1);
    expect(p).not.toHaveProperty("balance");
  });

  it("only the client can review, once; rating updates", async () => {
    await expectAppError(leaveReview(provider, orderId, { rating: 5, text: "", photos: [] }), 403);
    await leaveReview(client, orderId, { rating: 4, text: "Хорошо", photos: [] });
    await expectAppError(leaveReview(client, orderId, { rating: 5, text: "", photos: [] }), 409);
    const [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.reviewsCount).toBe(1);
    expect(p.ratingAvg).toBe(4);
  });

  it("admin can hide a review and stats recompute", async () => {
    const [r] = await db.select().from(s.reviews).where(eq(s.reviews.orderId, orderId));
    await runAdminAction(admin, { type: "review.visibility", id: r.id, status: "hidden" });
    const [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.reviewsCount).toBe(0);
    const [log] = await db.select().from(s.adminActions).where(eq(s.adminActions.targetId, r.id));
    expect(log.action).toBe("review.visibility");
  });
});

describe("direct orders & withdrawal", () => {
  it("provider can decline a direct order → it becomes public", async () => {
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Смеситель", description: "Нужно заменить смеситель", address: "ул. Рахова, 3", urgency: "week", photos: [], directProviderId: provider.provider!.id }, cityId);
    await expectAppError(getOrderDetail(o.id, stranger), 403);
    await orderAction(provider, o.id, { action: "decline" });
    const [after] = await db.select().from(s.orders).where(eq(s.orders.id, o.id));
    expect(after.directProviderId).toBeNull();
  });
  it("cannot order from yourself", async () => {
    await expectAppError(createOrder(provider, { subcategoryId: santehnikId, title: "Себе", description: "Заказ самому себе", address: "ул. 1", urgency: "week", photos: [], directProviderId: provider.provider!.id }, cityId), 400);
  });
});

describe("permissions", () => {
  it("non-admin cannot run admin-only actions", async () => {
    const mod = await asUser((await registerWithEmail({ name: "Мод", email: "mod@test.local", password: "password-123" })).id);
    await db.update(s.users).set({ role: "moderator" }).where(eq(s.users.id, mod.id));
    const modUser = (await userFromToken((await createSession(mod.id, "email")).token))!;
    await expectAppError(runAdminAction(modUser, { type: "city.toggle", id: cityId, isActive: false }), 403);
  });
});

describe("website login via the Telegram bot", () => {
  it("only the browser holding the nonce gets the session, exactly once", async () => {
    const r = await startTelegramLogin({ userAgent: "Mozilla/5.0 (iPhone) Safari/604.1", ip: "1.2.3.4" });
    expect(parseLoginStartParam(loginStartParam(r.token))).toBe(r.token);
    expect(loginStartParam(r.token).length).toBeLessThanOrEqual(64);
    expect((await claimTelegramLogin(r.id, r.nonce)).status).toBe("pending");
    const pending = await findPendingLogin(r.token);
    expect(pending?.id).toBe(r.id);
    expect(await findPendingLogin("wrong-token-wrong-token-wrong")).toBeNull();

    const user = await confirmTelegramLogin(r.id, { id: 555001, first_name: "Сайт", username: "site_user" });
    expect(user?.telegramId).toBe("555001");
    expect(await confirmTelegramLogin(r.id, { id: 999, first_name: "Чужой" })).toBeNull(); // cannot be re-confirmed

    await expectAppError(claimTelegramLogin(r.id, "someone-elses-nonce"), 403);
    await expectAppError(claimTelegramLogin(r.id, undefined), 403);
    const ok = await claimTelegramLogin(r.id, r.nonce);
    expect(ok).toEqual({ status: "ok", userId: user!.id });
    expect((await claimTelegramLogin(r.id, r.nonce)).status).toBe("expired"); // single use
  });

  it("reuses the account of a known Telegram user; rejection and expiry grant nothing", async () => {
    const a = await startTelegramLogin({});
    const u1 = await confirmTelegramLogin(a.id, { id: 555001, first_name: "Сайт" });
    const [row] = await db.select().from(s.users).where(eq(s.users.telegramId, "555001"));
    expect(u1?.id).toBe(row.id);

    const b = await startTelegramLogin({});
    await rejectTelegramLogin(b.id);
    expect((await claimTelegramLogin(b.id, b.nonce)).status).toBe("rejected");
    expect(await confirmTelegramLogin(b.id, { id: 555001, first_name: "Сайт" })).toBeNull();

    const c = await startTelegramLogin({});
    await db.update(s.loginRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(s.loginRequests.id, c.id));
    expect(await findPendingLogin(c.token)).toBeNull();
    expect(await confirmTelegramLogin(c.id, { id: 555001, first_name: "Сайт" })).toBeNull();
    expect((await claimTelegramLogin(c.id, c.nonce)).status).toBe("expired");
  });
});

describe("client deletes an order", () => {
  it("open order: cancelled and hidden from «Мои заказы»; only the client may delete", async () => {
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Удалю потом", description: "Проверка удаления заявки", address: "ул. Тестовая, 5", urgency: "week", photos: [] }, cityId);
    await expectAppError(orderAction(provider, o.id, { action: "delete" }), 403);
    await orderAction(client, o.id, { action: "delete" });
    const [row] = await db.select().from(s.orders).where(eq(s.orders.id, o.id));
    expect(row.status).toBe("cancelled");
    expect(row.clientHiddenAt).not.toBeNull();
    expect((await listClientOrders(client.id)).some((x) => x.id === o.id)).toBe(false);
    expect((await providerFeed(provider.provider!.id)).some((x) => x.id === o.id)).toBe(false);
  });
});

describe("new-order notifications", () => {
  it("matching providers get an order.new notification; «Не интересно» hides the order from their feed", async () => {
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Замена смесителя", description: "Нужно поменять смеситель на кухне", address: "ул. Чапаева, 10, кв. 3", urgency: "today", budget: 1500, photos: [] }, cityId);
    const notes = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, provider.id), eq(s.notifications.link, `/orders/${o.id}`)));
    expect(notes[0]?.type).toBe("order.new");
    expect(notes[0].body).not.toContain("кв. 3");
    expect((await providerFeed(provider.provider!.id)).some((f) => f.id === o.id)).toBe(true);
    await dismissOrder(provider.provider!.id, o.id);
    await dismissOrder(provider.provider!.id, o.id); // idempotent
    expect((await providerFeed(provider.provider!.id)).some((f) => f.id === o.id)).toBe(false);
  });
});

describe("free base features", () => {
  it("responses are unlimited for a provider without PRO", async () => {
    const bulk = await db
      .insert(s.orders)
      .values(Array.from({ length: 40 }, (_, i) => ({ clientId: client.id, cityId, subcategoryId: santehnikId, title: `Заявка ${i}`, description: "Массовая заявка", address: "ул. Тестовая, 1", status: "cancelled" as const })))
      .returning({ id: s.orders.id });
    await db.insert(s.orderResponses).values(bulk.map((o) => ({ orderId: o.id, providerId: provider.provider!.id, message: "Готов" })));
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Ещё одна", description: "Проверка лимита откликов", address: "ул. Тестовая, 2", urgency: "week", photos: [] }, cityId);
    const r = await respondToOrder(provider, o.id, { message: "Возьмусь", price: 900 });
    expect(r.conversationId).toBeTruthy();
  });
});

describe("optional monetisation (no acquiring)", () => {
  const on = () => (process.env.MONETIZATION_CHANNELS = "pro,promotion,ads");
  const off = () => (process.env.MONETIZATION_CHANNELS = "");

  it("with every channel off nothing can be bought and paid perks have no effect", async () => {
    off();
    await expectAppError(requestService(provider, "pro_month"), 404);
    const soon = new Date(Date.now() + 86400000);
    expect(perks({ proUntil: soon, boostedUntil: soon, highlightedUntil: null, promoUntil: soon })).toEqual({ pro: false, promo: false, boosted: false, highlighted: false });
    // fully free mode: every provider gets instant order cards
    expect(instantOrderCards({ promoUntil: null })).toBe(true);
    expect(await pickAd("home")).toBeNull();
  });

  it("request → invoice (no charge) → admin activates → PRO; idempotent", async () => {
    on();
    const inv = await requestService(provider, "pro_month");
    expect(inv.status).toBe("requested");
    await expectAppError(requestService(provider, "pro_month"), 409);
    let [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.proUntil).toBeNull();
    const adminNotes = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, admin.id), eq(s.notifications.type, "billing")));
    expect(adminNotes.length).toBeGreaterThan(0);

    await expectAppError(runAdminAction(await asUser(stranger.id), { type: "invoice.activate", id: inv.id }), 403);
    await runAdminAction(admin, { type: "invoice.activate", id: inv.id });
    await activate(inv.id, admin.id);
    const subs = await db.select().from(s.subscriptions).where(eq(s.subscriptions.providerId, provider.provider!.id));
    expect(subs.length).toBe(1);
    expect(subs[0].invoiceId).toBe(inv.id);
    [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.proUntil!.getTime()).toBeGreaterThan(Date.now() + 25 * 86400000);
    expect(p.verification).toBe("none"); // a paid badge never buys a trust level
    expect(perks(p).pro).toBe(true);
    off();
    expect(perks(p).pro).toBe(false);
  });

  it("owner can cancel an open request; strangers cannot; cancelled cannot be activated", async () => {
    on();
    const inv = await requestService(provider, "boost_24h");
    await expectAppError(cancelInvoice(stranger, inv.id), 404);
    await cancelInvoice(provider, inv.id);
    await expectAppError(activate(inv.id, admin.id), 409);
    const [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.boostedUntil).toBeNull();
  });

  it("clients without a provider profile cannot request paid services", async () => {
    on();
    await expectAppError(requestService(client, "boost_24h"), 403);
  });

  it("admin can grant a service for free (no invoice)", async () => {
    on();
    const [p0] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    await runAdminAction(admin, { type: "billing.grant", slug: p0.slug, productId: "highlight_7d" });
    const promos = await db.select().from(s.promotions).where(eq(s.promotions.providerId, p0.id));
    expect(promos.some((x) => x.kind === "highlight_7d" && x.invoiceId === null)).toBe(true);
  });

  it("«Продвижение» for Telegram Stars: only the issued amount, only from the invoice owner, activated once", async () => {
    on();
    const pid = provider.provider!.id;
    await expectAppError(requestService(provider, "promo_month"), 400); // not an off-platform invoice product
    await expectAppError(startStarsCheckout(provider, "promo_month"), 400); // no Telegram linked yet
    await db.update(s.users).set({ telegramId: "777001" }).where(eq(s.users.id, provider.id));
    const [inv] = await db.insert(s.invoices).values({ userId: provider.id, providerId: pid, productId: "promo_month", amount: 500, currency: "XTR" }).returning();
    const pay = { fromTelegramId: 777001, currency: "XTR", totalAmount: 500, payload: `inv:${inv.id}` };

    expect(await starsPreCheckoutError(pay)).toBeNull();
    expect(await starsPreCheckoutError({ ...pay, fromTelegramId: 999 })).toMatch(/другому/);
    expect(await starsPreCheckoutError({ ...pay, totalAmount: 1 })).toMatch(/Сумма/);
    expect(await starsPreCheckoutError({ ...pay, currency: "RUB" })).toMatch(/Сумма/);
    expect(await starsPreCheckoutError({ ...pay, payload: "inv:not-a-uuid" })).toMatch(/не найден/);
    expect(await completeStarsPayment({ ...pay, fromTelegramId: 999, chargeId: "forged" })).toBeNull();

    await completeStarsPayment({ ...pay, chargeId: "tg-charge-1" });
    await completeStarsPayment({ ...pay, chargeId: "tg-charge-1" }); // redelivered update
    const [done] = await db.select().from(s.invoices).where(eq(s.invoices.id, inv.id));
    expect(done.status).toBe("activated");
    expect(done.telegramChargeId).toBe("tg-charge-1");
    const [p] = await db.select().from(s.providers).where(eq(s.providers.id, pid));
    expect(p.promoUntil!.getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
    expect(p.promoUntil!.getTime()).toBeLessThan(Date.now() + 31 * 86400000); // extended once, not twice
    expect(perks(p)).toMatchObject({ promo: true, boosted: false }); // buys notifications only, not search position
    expect(instantOrderCards(p)).toBe(true);
    expect(instantOrderCards({ promoUntil: null })).toBe(false); // non-subscribers: in-app feed only
    expect(await starsPreCheckoutError(pay)).toMatch(/уже оплачен/); // the same invoice cannot be paid twice
    off();
    expect(instantOrderCards({ promoUntil: null })).toBe(true); // channel off → everyone gets cards again
  });

  it("ads are labelled data, served only when the channel is on; unsafe links are never followed", async () => {
    on();
    const now = Date.now();
    await runAdminAction(admin, { type: "ad.create", slot: "search", title: "Тестовая реклама", linkUrl: "https://example.com/x", advertiser: "ООО Тест", erid: "TEST1", startsAt: new Date(now - 3600000).toISOString(), endsAt: new Date(now + 86400000).toISOString() });
    const ad = await pickAd("search");
    expect(ad?.advertiser).toBe("ООО Тест");
    expect(await adClick(ad!.id)).toBe("https://example.com/x");
    const [bad] = await db.insert(s.ads).values({ slot: "home", title: "x", linkUrl: "javascript:alert(1)", advertiser: "x", startsAt: new Date(now - 1000), endsAt: new Date(now + 1000000) }).returning();
    expect(await adClick(bad.id)).toBeNull();
    off();
    expect(await pickAd("search")).toBeNull();
  });
});

describe("client contacts and Telegram response cards", () => {
  it("a phone typed into the order is hidden from providers until one is chosen", async () => {
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Протечка, звоните +7 917 300-28-25", description: "Течёт кран. Мой номер 89173002825, почта me@mail.ru", address: "ул. Чапаева, 12", urgency: "week", photos: [] }, cityId);
    const asProvider = await getOrderDetail(o.id, provider);
    expect(asProvider.order.title).toBe("Протечка, звоните [контакт скрыт]");
    expect(asProvider.order.description).not.toMatch(/917|mail\.ru/);
    const feed = await providerFeed(provider.provider!.id);
    const inFeed = feed.find((x) => x.id === o.id)!;
    expect(inFeed.description).not.toMatch(/917/);
    expect((await getOrderDetail(o.id, client)).order.description).toContain("89173002825"); // the client sees their own text
    await orderAction(client, o.id, { action: "cancel", reason: "тест" });
  });

  it("«Выбрать» in Telegram: only the owner, with confirmation, once", async () => {
    await db.update(s.users).set({ telegramId: "91000001" }).where(eq(s.users.id, client.id));
    await db.update(s.users).set({ telegramId: "91000002" }).where(eq(s.users.id, stranger.id));
    const o = await createOrder(client, { subcategoryId: santehnikId, title: "Поменять сифон", description: "Старый сифон треснул", address: "ул. Рахова, 7", urgency: "week", photos: [] }, cityId);
    const { resp } = await respondToOrder(provider, o.id, { message: "Сделаю сегодня", price: 1200 });
    // stand-in for the Bot API: record what the bot would send
    const sent: { method: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      sent.push({ method: String(url).split("/").pop()!, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: true }));
    });
    const tap = (fromId: number, data: string) => handleUpdate({ update_id: 1, callback_query: { id: "cb", from: { id: fromId, first_name: "x" }, data, message: { message_id: 7, chat: { id: fromId } } } });
    const lastEdit = () => String([...sent].reverse().find((x) => x.method === "editMessageText")?.body.text ?? "");
    const status = async () => (await db.select().from(s.orders).where(eq(s.orders.id, o.id)))[0].status;

    await tap(91000002, `pickok:${resp.id}`); // a stranger pressing a forwarded button
    expect(await status()).toBe("responses");
    expect(sent.some((x) => x.method === "editMessageText")).toBe(false); // the stranger changed nothing
    await tap(91000001, `pick:${resp.id}`); // first tap only asks for confirmation
    expect(await status()).toBe("responses");
    expect(lastEdit()).toContain("Выбрать <b>Мастер Тест</b> за 1");
    await tap(91000001, `pickno:${resp.id}`); // «Назад» restores the card
    expect(lastEdit()).toContain("Новый отклик");
    await tap(91000001, `pickok:${resp.id}`);
    await tap(91000001, `pickok:${resp.id}`); // double tap
    const [after] = await db.select().from(s.orders).where(eq(s.orders.id, o.id));
    expect(after.status).toBe("assigned");
    expect(after.providerId).toBe(provider.provider!.id);
    const events = await db.select().from(s.orderEvents).where(and(eq(s.orderEvents.orderId, o.id), eq(s.orderEvents.type, "assigned")));
    expect(events.length).toBe(1);
    expect(sent.filter((x) => x.method === "editMessageText").some((x) => String(x.body.text).startsWith("✅ Вы выбрали"))).toBe(true);
    await orderAction(client, o.id, { action: "cancel", reason: "тест" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe("encrypted database backups to the admins' Telegram", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BACKUP_PASSWORD;
  });

  it("refuses without a password, then sends an encrypted, restorable copy", async () => {
    delete process.env.BACKUP_PASSWORD;
    await expect(runBackup("manual")).rejects.toThrow(/BACKUP_PASSWORD/);
    process.env.BACKUP_PASSWORD = "correct-horse-battery";
    await db.update(s.users).set({ telegramId: "91000099" }).where(eq(s.users.id, admin.id));

    const sent: { chatId: string; file: Buffer; name: string }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: FormData }) => {
      const doc = init.body.get("document") as File;
      sent.push({ chatId: String(init.body.get("chat_id")), file: Buffer.from(await doc.arrayBuffer()), name: doc.name });
      return new Response(JSON.stringify({ ok: true, result: {} }));
    });
    await expectAppError(runAdminAction(await asUser(stranger.id), { type: "backup.run" }), 403);
    const r = (await runAdminAction(admin, { type: "backup.run" })) as Awaited<ReturnType<typeof runBackup>>;
    expect(r.sent).toBe(1);
    expect(sent[0].chatId).toBe("91000099");
    expect(sent[0].name).toMatch(/^ryadom-backup-.*\.rydb$/);

    // the file is useless without the password and complete with it
    expect(sent[0].file.toString("latin1")).not.toContain("client@test.local");
    expect(() => decryptBackup(sent[0].file, "wrong-password-123")).toThrow(/пароль/);
    const payload = decryptBackup(sent[0].file, "correct-horse-battery");
    const [{ n }] = (await db.execute<{ n: number }>(sql`select count(*)::int n from users`)).rows;
    expect(payload.tables.users.length).toBe(n);
    expect(payload.tables.users.some((u) => (u as { email: string }).email === "client@test.local")).toBe(true);
    expect(Object.keys(payload.tables)).toEqual(expect.arrayContaining(["orders", "providers", "reviews", "messages", "invoices"]));

    const last = await lastBackup();
    expect(last).toMatchObject({ sent: 1, stale: false });
  });
});

describe("demo data purge before launch", () => {
  it("removes every demo account and demo ad, keeps real ones, cancels real orders taken by a demo provider", async () => {
    // a miniature of what `seed --demo` creates: demo client, demo provider, demo ad
    const [dc] = await db.insert(s.users).values({ name: "Демо Клиент", email: "client1@demo.ryadom.local", cityId }).returning();
    const [dpu] = await db.insert(s.users).values({ name: "Демо Мастер", email: "master-42@demo.ryadom.local", cityId }).returning();
    const [dp] = await db.insert(s.providers).values({ userId: dpu.id, slug: "demo-master-42", displayName: "Демо Мастер", headline: "Демо", primarySubcategoryId: santehnikId, cityId, status: "active" }).returning();
    await db.insert(s.ads).values({ slot: "home", title: "Демо", linkUrl: "https://example.com", advertiser: "ООО Пример (демо)", erid: "DEMO123", startsAt: new Date(), endsAt: new Date(Date.now() + 86400000) });
    // a demo client's completed order + review of a REAL provider → the real provider's rating must be recomputed
    const [dOrder] = await db.insert(s.orders).values({ clientId: dc.id, cityId, subcategoryId: santehnikId, title: "Демо заказ", description: "Демо", address: "ул. 1", status: "completed", providerId: provider.provider!.id }).returning();
    await db.insert(s.reviews).values({ orderId: dOrder.id, providerId: provider.provider!.id, authorId: dc.id, rating: 1, text: "демо-отзыв" });
    // a REAL client's active order taken by the demo provider → cancelled
    const [real] = await db.insert(s.orders).values({ clientId: client.id, cityId, subcategoryId: santehnikId, title: "Реальная заявка", description: "Выбран демо-мастер", address: "ул. 1", status: "assigned", providerId: dp.id }).returning();
    const reviewsBefore = (await db.select().from(s.reviews).where(eq(s.reviews.providerId, provider.provider!.id))).length;

    const before = await demoSummary();
    expect(before).toMatchObject({ users: 2, providers: 1, ads: 1 });
    process.env.DEMO_MODE = "true";
    await expectAppError(purgeDemo(), 409); // would be re-seeded on the next start
    delete process.env.DEMO_MODE;
    await expectAppError(runAdminAction(await asUser(stranger.id), { type: "demo.purge", confirm: "УДАЛИТЬ" }), 403);
    const r = (await runAdminAction(admin, { type: "demo.purge", confirm: "УДАЛИТЬ" })) as Awaited<ReturnType<typeof purgeDemo>>;
    expect(r).toMatchObject({ users: 2, providers: 1, ads: 1, cancelledOrders: 1, recomputed: 1 });

    expect(await demoSummary()).toMatchObject({ users: 0, providers: 0, ads: 0 });
    expect((await db.select().from(s.orders).where(eq(s.orders.id, real.id)))[0].status).toBe("cancelled");
    for (const u of [client, provider, admin, stranger]) expect((await db.select().from(s.users).where(eq(s.users.id, u.id))).length).toBe(1);
    const [p] = await db.select().from(s.providers).where(eq(s.providers.id, provider.provider!.id));
    expect(p.status).toBe("active");
    const reviewsAfter = await db.select().from(s.reviews).where(eq(s.reviews.providerId, provider.provider!.id));
    expect(reviewsAfter.length).toBe(reviewsBefore - 1);
    expect(p.reviewsCount).toBe(reviewsAfter.filter((x) => x.status === "visible").length);
    expect((await db.select().from(s.adminActions).where(eq(s.adminActions.action, "demo.purge"))).length).toBe(1);
  });
});
