import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db, type DbOrTx } from "../db";
import { notifications, users } from "../db/schema";
import { escapeHtml, sendMessage, telegramEnabled, webAppUrl } from "../telegram/bot";
import { sendEmail } from "./channels";
import { log } from "../log";

export type NotificationType =
  | "order.new"
  | "order.response"
  | "order.assigned"
  | "order.status"
  | "message.new"
  | "review.new"
  | "reminder"
  | "provider.moderation"
  | "payment"
  | "system";

export type NotifyInput = { type: NotificationType; title: string; body?: string; link?: string };

/** Types that are also pushed via email (others are in-app + Telegram only). */
const EMAIL_TYPES = new Set<NotificationType>(["order.assigned", "provider.moderation", "payment", "review.new"]);

function runLater(fn: () => Promise<void>) {
  try {
    after(fn);
  } catch {
    // outside of a request scope (scripts / tests)
    void fn().catch((e) => log.error("notification dispatch failed", { e: String(e) }));
  }
}

/** Creates an in-app notification and fans out to external channels asynchronously. */
export async function notify(userId: string, input: NotifyInput, tx: DbOrTx = db) {
  const [row] = await tx.insert(notifications).values({ userId, type: input.type, title: input.title, body: input.body ?? "", link: input.link }).returning({ id: notifications.id });
  runLater(() => dispatch(row.id, userId, input));
  return row.id;
}

async function dispatch(notificationId: string, userId: string, input: NotifyInput) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return;
  const deliveries: Record<string, string> = { inapp: "stored" };

  if (u.telegramId && u.notifyTelegram) {
    if (!telegramEnabled()) deliveries.telegram = "disabled";
    else {
      try {
        const text = `<b>${escapeHtml(input.title)}</b>${input.body ? `\n${escapeHtml(input.body)}` : ""}`;
        await sendMessage(u.telegramId, text, input.link ? { inline_keyboard: [[{ text: "Открыть", web_app: { url: webAppUrl(input.link) } }]] } : undefined);
        deliveries.telegram = "sent";
      } catch (e) {
        deliveries.telegram = "failed";
        log.warn("telegram notify failed", { userId, e: String(e) });
      }
    }
  }
  if (u.email && u.notifyEmail && EMAIL_TYPES.has(input.type)) {
    try {
      deliveries.email = await sendEmail(u.email, input.title, `${input.body ?? ""}\n\n${input.link ? webAppUrl(input.link) : ""}`);
    } catch {
      deliveries.email = "failed";
    }
  }
  await db.update(notifications).set({ deliveries }).where(eq(notifications.id, notificationId));
}
