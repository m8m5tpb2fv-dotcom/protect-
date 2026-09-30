import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db";
import { loginRequests } from "../db/schema";
import { AppError } from "../http/errors";
import { hashToken } from "./session";
import { upsertTelegramUser, type TelegramIdentity } from "./service";

/**
 * «Войти через Telegram» for the website, via our bot (works on phones, no BotFather domain setup):
 *  1. start(): the browser gets a one-time deep link t.me/<bot>?start=login_<token> and an httpOnly nonce cookie;
 *  2. the user opens the bot; the bot shows who/when asked and a «Войти» button (explicit confirmation);
 *  3. confirm(): the Telegram identity comes from an update delivered to our authenticated webhook;
 *  4. claim(): only the browser holding the nonce receives the session, once.
 * Token and nonce are stored as HMAC hashes; requests live 10 minutes.
 */

export const LOGIN_TTL_MS = 10 * 60_000;
export const LOGIN_NONCE_COOKIE = "ryadom_tglogin";
const PREFIX = "login_";

export function loginStartParam(token: string) {
  return `${PREFIX}${token}`;
}
export function parseLoginStartParam(param: string | undefined) {
  return param?.startsWith(PREFIX) && /^[A-Za-z0-9_-]{20,60}$/.test(param.slice(PREFIX.length)) ? param.slice(PREFIX.length) : null;
}

export async function startTelegramLogin(meta: { userAgent?: string | null; ip?: string | null }) {
  const token = randomBytes(24).toString("base64url"); // 32 chars → start param fits the 64-char limit
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS);
  // housekeeping: drop long-expired requests
  await db.delete(loginRequests).where(lt(loginRequests.expiresAt, new Date(Date.now() - 24 * 3600_000)));
  const [r] = await db
    .insert(loginRequests)
    .values({ tokenHash: hashToken(token), nonceHash: hashToken(nonce), userAgent: meta.userAgent?.slice(0, 300) ?? null, ip: meta.ip ?? null, expiresAt })
    .returning({ id: loginRequests.id });
  return { id: r.id, token, nonce, expiresAt };
}

/** Request shown in the bot before confirmation (null when unknown / expired / already handled). */
export async function findPendingLogin(token: string) {
  const [r] = await db
    .select()
    .from(loginRequests)
    .where(and(eq(loginRequests.tokenHash, hashToken(token)), eq(loginRequests.status, "pending"), gt(loginRequests.expiresAt, new Date())));
  return r ?? null;
}

/** Called from the bot webhook when the user presses «Войти». */
export async function confirmTelegramLogin(requestId: string, tg: TelegramIdentity) {
  const [r] = await db
    .select()
    .from(loginRequests)
    .where(and(eq(loginRequests.id, requestId), eq(loginRequests.status, "pending"), gt(loginRequests.expiresAt, new Date())));
  if (!r) return null;
  const { user } = await upsertTelegramUser(tg, { chatAllowed: true }); // they are talking to the bot right now
  const [done] = await db
    .update(loginRequests)
    .set({ status: "confirmed", userId: user.id, confirmedAt: new Date() })
    .where(and(eq(loginRequests.id, r.id), eq(loginRequests.status, "pending")))
    .returning({ id: loginRequests.id });
  return done ? user : null;
}

export async function rejectTelegramLogin(requestId: string) {
  await db.update(loginRequests).set({ status: "rejected" }).where(and(eq(loginRequests.id, requestId), eq(loginRequests.status, "pending")));
}

/** Polled by the browser. Hands out the user id exactly once, and only to the browser holding the nonce. */
export async function claimTelegramLogin(requestId: string, nonce: string | undefined): Promise<{ status: "pending" | "expired" | "rejected" } | { status: "ok"; userId: string }> {
  if (!nonce) throw new AppError(403, "forbidden", "Начните вход заново");
  const [r] = await db.select().from(loginRequests).where(eq(loginRequests.id, requestId));
  if (!r || r.nonceHash !== hashToken(nonce)) throw new AppError(403, "forbidden", "Начните вход заново");
  if (r.status === "rejected") return { status: "rejected" };
  if (r.status === "confirmed" && r.userId) {
    const [claimed] = await db
      .update(loginRequests)
      .set({ status: "used" })
      .where(and(eq(loginRequests.id, r.id), eq(loginRequests.status, "confirmed")))
      .returning({ userId: loginRequests.userId });
    if (claimed?.userId) return { status: "ok", userId: claimed.userId };
    return { status: "expired" };
  }
  if (r.status !== "pending" || r.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  return { status: "pending" };
}

/** Short human description of the requesting device for the confirmation message. */
export function describeDevice(ua: string | null) {
  if (!ua) return "неизвестное устройство";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "устройство";
  const browser = /YaBrowser/.test(ua) ? "Яндекс Браузер" : /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "браузер";
  return `${browser}, ${os}`;
}
