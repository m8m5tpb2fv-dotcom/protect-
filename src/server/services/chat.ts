import "server-only";
import { and, asc, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { maskContacts } from "@/lib/contacts";
import { db } from "../db";
import { conversations, messages, orders, providers, users, type MessageAttachment } from "../db/schema";
import type { CurrentUser } from "../auth/session";
import { badRequest, forbidden, notFound } from "../http/errors";
import { notify } from "../notifications/notify";
import { upsertConversation } from "./orders";

export type ConversationListItem = {
  id: string;
  asRole: "client" | "provider";
  peerName: string;
  peerAvatar: string | null;
  peerSlug: string | null;
  orderTitle: string | null;
  orderId: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string;
  unread: number;
};

export async function listConversations(user: CurrentUser): Promise<ConversationListItem[]> {
  const pid = user.provider?.id ?? "00000000-0000-0000-0000-000000000000";
  const rows = await db
    .select({
      c: conversations,
      providerName: providers.displayName,
      providerAvatar: providers.avatarUrl,
      providerSlug: providers.slug,
      clientName: users.name,
      clientAvatar: users.avatarUrl,
      orderTitle: orders.title,
      unread: sql<number>`(select count(*)::int from ${messages} m where m.conversation_id = ${conversations.id} and m.read_at is null and (m.sender_id is distinct from ${user.id}))`,
    })
    .from(conversations)
    .innerJoin(providers, eq(providers.id, conversations.providerId))
    .innerJoin(users, eq(users.id, conversations.clientId))
    .leftJoin(orders, eq(orders.id, conversations.orderId))
    .where(or(eq(conversations.clientId, user.id), eq(conversations.providerId, pid)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);
  return rows.map((r) => {
    const asRole = r.c.clientId === user.id ? "client" : "provider";
    return {
      id: r.c.id,
      asRole,
      peerName: asRole === "client" ? r.providerName : r.clientName,
      peerAvatar: asRole === "client" ? r.providerAvatar : r.clientAvatar,
      peerSlug: asRole === "client" ? r.providerSlug : null,
      orderTitle: r.orderTitle != null && asRole === "provider" ? maskContacts(r.orderTitle) : r.orderTitle,
      orderId: r.c.orderId,
      lastMessageAt: r.c.lastMessageAt,
      lastMessagePreview: r.c.lastMessagePreview,
      unread: r.unread,
    };
  });
}

export async function conversationAccess(conversationId: string, user: CurrentUser) {
  const [row] = await db
    .select({ c: conversations, providerUserId: providers.userId, providerName: providers.displayName, providerAvatar: providers.avatarUrl, providerSlug: providers.slug, providerPhone: providers.phone, clientName: users.name, clientAvatar: users.avatarUrl, orderTitle: orders.title, orderStatus: orders.status })
    .from(conversations)
    .innerJoin(providers, eq(providers.id, conversations.providerId))
    .innerJoin(users, eq(users.id, conversations.clientId))
    .leftJoin(orders, eq(orders.id, conversations.orderId))
    .where(eq(conversations.id, conversationId));
  if (!row) throw notFound("Диалог не найден");
  const isClient = row.c.clientId === user.id;
  const isProvider = row.providerUserId === user.id;
  if (!isClient && !isProvider) throw forbidden();
  return {
    conversation: row.c,
    asRole: isClient ? ("client" as const) : ("provider" as const),
    peer: isClient
      ? { name: row.providerName, avatar: row.providerAvatar, slug: row.providerSlug, userId: row.providerUserId }
      : { name: row.clientName, avatar: row.clientAvatar, slug: null, userId: row.c.clientId },
    order: row.c.orderId ? { id: row.c.orderId, title: row.orderTitle != null && !isClient ? maskContacts(row.orderTitle) : row.orderTitle, status: row.orderStatus } : null,
  };
}

export async function listMessages(conversationId: string, user: CurrentUser, opts: { after?: string } = {}) {
  await conversationAccess(conversationId, user);
  const conds = [eq(messages.conversationId, conversationId)];
  if (opts.after) {
    const d = new Date(opts.after);
    if (!Number.isNaN(d.getTime())) conds.push(gt(messages.createdAt, d));
  }
  const rows = await db.select().from(messages).where(and(...conds)).orderBy(asc(messages.createdAt)).limit(500);
  // mark incoming as read
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.readAt), or(ne(messages.senderId, user.id), isNull(messages.senderId))));
  // read receipts for own messages (the peer may have read them since)
  return rows;
}

export async function sendChatMessage(conversationId: string, user: CurrentUser, input: { body: string; attachments: MessageAttachment[] }) {
  const access = await conversationAccess(conversationId, user);
  if (!input.body && !input.attachments.length) throw badRequest("Пустое сообщение");
  const [prev] = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(1);
  const [m] = await db
    .insert(messages)
    .values({ conversationId, senderId: user.id, kind: input.attachments.length && !input.body ? "image" : "text", body: input.body, attachments: input.attachments.length ? input.attachments : null })
    .returning();
  const preview = input.body || "📷 Фото";
  await db.update(conversations).set({ lastMessageAt: m.createdAt, lastMessagePreview: preview.slice(0, 120) }).where(eq(conversations.id, conversationId));
  // Throttle push notifications: only if the previous message wasn't an unread one from the same sender within 3 minutes.
  const burst = prev && prev.senderId === user.id && !prev.readAt && m.createdAt.getTime() - prev.createdAt.getTime() < 180_000;
  if (!burst) {
    const senderName = access.asRole === "provider" ? (user.provider?.displayName ?? user.name) : user.name;
    await notify(access.peer.userId, { type: "message.new", title: `Сообщение от ${senderName}`, body: preview.slice(0, 140), link: `/messages/${conversationId}` });
  }
  return m;
}

/** Client ↔ provider chat start (from provider profile «Написать»). */
export async function startConversation(user: CurrentUser, providerId: string, orderId?: string | null, body?: string) {
  const [p] = await db.select().from(providers).where(eq(providers.id, providerId));
  if (!p || p.status !== "active") throw notFound("Исполнитель не найден");
  if (p.userId === user.id) throw badRequest("Это ваш профиль");
  if (orderId) {
    const [o] = await db.select({ clientId: orders.clientId }).from(orders).where(eq(orders.id, orderId));
    if (!o || o.clientId !== user.id) throw forbidden();
  }
  const id = await upsertConversation(db, user.id, providerId, orderId ?? null);
  if (body) await sendChatMessage(id, user, { body, attachments: [] });
  return id;
}

export async function unreadMessagesCount(user: CurrentUser) {
  const pid = user.provider?.id ?? "00000000-0000-0000-0000-000000000000";
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(isNull(messages.readAt), or(ne(messages.senderId, user.id), isNull(messages.senderId)), or(eq(conversations.clientId, user.id), eq(conversations.providerId, pid))));
  return r?.n ?? 0;
}
