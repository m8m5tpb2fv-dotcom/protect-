import "server-only";
import { env } from "../env";
import { log } from "../log";

type InlineButton = { text: string; url?: string; web_app?: { url: string }; callback_data?: string };
export type ReplyMarkup = { inline_keyboard: InlineButton[][] };

export const telegramEnabled = () => !!env.TELEGRAM_BOT_TOKEN;

export async function tg<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!telegramEnabled()) {
    log.info(`[telegram disabled] ${method}`, { payload: JSON.stringify(payload).slice(0, 300) });
    return null;
  }
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!json?.ok) {
    log.warn("telegram api error", { method, status: res.status, description: json?.description });
    throw new Error(json?.description ?? `Telegram ${method} failed`);
  }
  return json.result ?? null;
}

export function sendMessage(chatId: string | number, text: string, markup?: ReplyMarkup) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export function editMessage(chatId: number, messageId: number, text: string) {
  return tg("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" });
}

/** Absolute URL of a page inside the web app (used for Mini App web_app buttons). */
export function webAppUrl(path = "/") {
  return new URL(path, env.APP_URL).toString();
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram Stars invoice link (currency XTR, no provider token). Opened via WebApp.openInvoice or as a t.me link. */
export function createStarsInvoiceLink(i: { title: string; description: string; payload: string; stars: number }) {
  return tg<string>("createInvoiceLink", { title: i.title, description: i.description, payload: i.payload, currency: "XTR", prices: [{ label: i.title, amount: i.stars }] });
}

/** Must be answered within 10 seconds of a pre_checkout_query, otherwise the payment fails. */
export function answerPreCheckout(queryId: string, error: string | null) {
  return tg("answerPreCheckoutQuery", error ? { pre_checkout_query_id: queryId, ok: false, error_message: error } : { pre_checkout_query_id: queryId, ok: true });
}
