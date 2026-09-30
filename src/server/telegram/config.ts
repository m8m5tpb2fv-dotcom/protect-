import "server-only";
import { createHmac } from "node:crypto";
import type { DeepLinkTarget } from "@/lib/deeplink";
import { miniAppUrl } from "@/lib/deeplink";
import { env } from "../env";
import { log } from "../log";

/**
 * Everything the bot needs is derived from TELEGRAM_BOT_TOKEN, so an operator only sets the token:
 *  - webhook secret: explicit TELEGRAM_WEBHOOK_SECRET or HMAC(SESSION_SECRET, token) — stable across restarts, never exposed;
 *  - bot username: explicit TELEGRAM_BOT_USERNAME or getMe (cached);
 *  - public https URL: APP_URL (Railway domain fallback in env.ts).
 */
export function webhookSecret(): string {
  if (env.TELEGRAM_WEBHOOK_SECRET) return env.TELEGRAM_WEBHOOK_SECRET;
  if (!env.TELEGRAM_BOT_TOKEN || !env.SESSION_SECRET) return "";
  // Telegram allows [A-Za-z0-9_-]{1,256}
  return createHmac("sha256", env.SESSION_SECRET).update(`telegram-webhook:${env.TELEGRAM_BOT_TOKEN}`).digest("hex");
}

let username: Promise<string> | null = null;

/** Bot @username without "@", or "" when the bot isn't configured / reachable. */
export function botUsername(): Promise<string> {
  if (env.TELEGRAM_BOT_USERNAME) return Promise.resolve(env.TELEGRAM_BOT_USERNAME.replace(/^@/, ""));
  if (!env.TELEGRAM_BOT_TOKEN) return Promise.resolve("");
  username ??= fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json() as Promise<{ ok: boolean; result?: { username?: string } }>)
    .then((j) => {
      if (!j.ok || !j.result?.username) throw new Error("getMe failed");
      return j.result.username;
    })
    .catch((e) => {
      log.warn("telegram getMe failed", { e: String(e) });
      username = null; // retry on the next call
      return "";
    });
  return username;
}

/** Link that opens a screen in Telegram, or null when the bot isn't configured. */
export async function telegramLink(t?: DeepLinkTarget) {
  return miniAppUrl(await botUsername(), env.TELEGRAM_APP_NAME, t);
}
