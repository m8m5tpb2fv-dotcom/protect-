import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "../db";
import { providers, sessions, users, type Provider, type User } from "../db/schema";
import { env } from "../env";
import { forbidden, unauthorized } from "../http/errors";

export const SESSION_COOKIE = "ryadom_session";
const SESSION_TTL_DAYS = 60;

export type AuthMethod = "email" | "phone" | "telegram" | "demo";
export type CurrentUser = Pick<User, "id" | "name" | "email" | "phone" | "role" | "avatarUrl" | "telegramId" | "telegramUsername" | "cityId" | "districtId" | "notifyEmail" | "notifyTelegram" | "createdAt"> & {
  provider: Pick<Provider, "id" | "slug" | "status" | "displayName" | "isAvailable" | "verification" | "proUntil"> | null;
};

function secret() {
  if (!env.SESSION_SECRET && env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return env.SESSION_SECRET || "dev-insecure-secret";
}

export function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

/** Creates a DB session and returns the raw token (only ever sent to the client). */
export async function createSession(userId: string, method: AuthMethod, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, method, userAgent: meta.userAgent?.slice(0, 300), ip: meta.ip, expiresAt });
  return { token, expiresAt };
}

export function isSecureContext() {
  return env.APP_URL.startsWith("https://");
}

/** Cookie options. In HTTPS deployments the cookie is SameSite=None + Partitioned so it also works inside the Telegram Web iframe. */
export function sessionCookieOptions(expiresAt: Date) {
  const secure = isSecureContext();
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    partitioned: secure || undefined,
    path: "/",
    expires: expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function destroySession() {
  const token = await readToken();
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}

async function readToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function userFromToken(token: string | null): Promise<CurrentUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await db
    .select({ user: users, provider: providers, expiresAt: sessions.expiresAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(providers, eq(providers.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.isBlocked) return null;
  const u = row.user;
  // touch last seen at most once per 10 min
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 600_000) {
    db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, u.id)).catch(() => {});
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.avatarUrl,
    telegramId: u.telegramId,
    telegramUsername: u.telegramUsername,
    cityId: u.cityId,
    districtId: u.districtId,
    notifyEmail: u.notifyEmail,
    notifyTelegram: u.notifyTelegram,
    createdAt: u.createdAt,
    provider: row.provider
      ? {
          id: row.provider.id,
          slug: row.provider.slug,
          status: row.provider.status,
          displayName: row.provider.displayName,
          isAvailable: row.provider.isAvailable,
          verification: row.provider.verification,
          proUntil: row.provider.proUntil,
        }
      : null,
  };
}

/** Current user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => userFromToken(await readToken()));

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requireAdmin(roles: ("admin" | "moderator")[] = ["admin", "moderator"]) {
  const u = await requireUser();
  if (!roles.includes(u.role as "admin")) throw forbidden();
  return u;
}

export async function requireProvider() {
  const u = await requireUser();
  if (!u.provider) throw forbidden("Сначала заполните профиль исполнителя");
  return u as CurrentUser & { provider: NonNullable<CurrentUser["provider"]> };
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim(),
    userAgent: h.get("user-agent"),
  };
}
