import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { contentBlocks, favorites, notifications, providers, reports, supportTickets, users } from "../db/schema";
import type { CurrentUser } from "../auth/session";
import { badRequest, notFound } from "../http/errors";
import { getGeo } from "./catalog";
import { unreadMessagesCount } from "./chat";

export async function listNotifications(userId: string, limit = 50) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const conds = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (ids?.length) conds.push(inArray(notifications.id, ids));
  await db.update(notifications).set({ readAt: new Date() }).where(and(...conds));
}

export async function summary(user: CurrentUser) {
  const [[n], messages] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    unreadMessagesCount(user),
  ]);
  return { unreadNotifications: n.n, unreadMessages: messages };
}

export async function toggleFavorite(userId: string, providerId: string) {
  const [p] = await db.select({ id: providers.id }).from(providers).where(eq(providers.id, providerId));
  if (!p) throw notFound();
  const [existing] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.providerId, providerId)));
  if (existing) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.providerId, providerId)));
    return { favorite: false };
  }
  await db.insert(favorites).values({ userId, providerId });
  return { favorite: true };
}

export async function createReport(userId: string, input: { targetType: string; targetId: string; reason: string; text: string }) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(eq(reports.reporterId, userId), sql`${reports.createdAt} > now() - interval '1 day'`));
  if (n >= 10) throw badRequest("Слишком много жалоб за сутки");
  await db.insert(reports).values({ reporterId: userId, ...input });
}

export async function createTicket(user: CurrentUser | null, input: { subject: string; body: string; email?: string }) {
  if (!user && !input.email) throw badRequest("Укажите email для ответа");
  await db.insert(supportTickets).values({ userId: user?.id ?? null, email: input.email ?? user?.email ?? null, subject: input.subject, body: input.body });
}

export async function myTickets(userId: string) {
  return db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)).limit(20);
}

export async function updateProfile(user: CurrentUser, input: { name?: string; districtId?: number | null; avatarUrl?: string | null; notifyEmail?: boolean; notifyTelegram?: boolean }) {
  if (input.districtId) {
    const geo = await getGeo();
    if (!geo.districtById.has(input.districtId)) throw badRequest("Район не найден");
  }
  await db
    .update(users)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.districtId !== undefined ? { districtId: input.districtId } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.notifyEmail !== undefined ? { notifyEmail: input.notifyEmail } : {}),
      ...(input.notifyTelegram !== undefined ? { notifyTelegram: input.notifyTelegram } : {}),
    })
    .where(eq(users.id, user.id));
}

export async function getContent(keys: string[]) {
  const rows = await db.select().from(contentBlocks).where(and(inArray(contentBlocks.key, keys), eq(contentBlocks.isActive, true)));
  return Object.fromEntries(rows.map((r) => [r.key, r]));
}

export async function allContent() {
  return db.select().from(contentBlocks).orderBy(contentBlocks.key);
}
