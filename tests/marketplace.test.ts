/**
 * Integration tests against a real PostgreSQL (ryadom_test).
 * Cover the critical marketplace flow, permissions, auth and the zero-commission / optional monetisation model.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "@/server/db/schema";
import { db } from "@/server/db";
import { seedReference } from "@/server/db/seed";
import { createSession, userFromToken, type CurrentUser } from "@/server/auth/session";
import { loginWithEmail, loginWithTelegram, registerWithEmail, requestPhoneCode, verifyPhoneCode } from "@/server/auth/service";
import { signInitData } from "@/server/telegram/init-data";
import { createOrder, getOrderDetail, leaveReview, orderAction, respondToOrder } from "@/server/services/orders";
import { createProviderProfile } from "@/server/services/provider-self";
import { listMessages, sendChatMessage, startConversation } from "@/server/services/chat";
import { searchProviders } from "@/server/services/providers";
import { runAdminAction } from "@/server/services/admin";
import { activate, cancelInvoice, perks, requestService } from "@/server/billing";
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
    expect(perks({ proUntil: new Date(Date.now() + 86400000), boostedUntil: new Date(Date.now() + 86400000), highlightedUntil: null })).toEqual({ pro: false, boosted: false, highlighted: false });
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
