import { timingSafeEqual } from "node:crypto";
import { log } from "@/server/log";
import { handleUpdate } from "@/server/telegram/handlers";
import { webhookSecret } from "@/server/telegram/config";

/** Telegram Bot webhook. Authenticated by X-Telegram-Bot-Api-Secret-Token. */
export async function POST(req: Request) {
  const given = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const secret = webhookSecret();
  const expected = Buffer.from(secret);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("forbidden", { status: 403 });
  try {
    await handleUpdate(await req.json());
  } catch (e) {
    log.error("telegram update failed", { e: String(e) });
  }
  return Response.json({ ok: true }); // always 200 so Telegram doesn't retry forever
}
