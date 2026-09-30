import "dotenv/config";
import { env } from "../src/server/env";
import { webhookSecret } from "../src/server/telegram/config";

/**
 * Configures the bot: webhook, commands, menu button (opens the Mini App), descriptions.
 * Runs automatically on container start when TELEGRAM_BOT_TOKEN is set (scripts/start.sh);
 * manual run: npm run telegram:setup. Idempotent.
 */
async function call(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!json.ok) throw new Error(`${method}: ${json.description ?? res.status}`);
  return json.result;
}

async function main() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log("• TELEGRAM_BOT_TOKEN not set — Telegram bot skipped");
    return;
  }
  const url = env.APP_URL.replace(/\/$/, "");
  if (!url.startsWith("https://")) throw new Error(`APP_URL must be public https for Telegram (now: ${url})`);
  const secret = webhookSecret();
  if (!secret) throw new Error("Set SESSION_SECRET (or TELEGRAM_WEBHOOK_SECRET)");

  const me = (await call("getMe", {})) as { username: string };
  await call("setWebhook", { url: `${url}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message", "my_chat_member", "callback_query", "pre_checkout_query"], drop_pending_updates: false });
  await call("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть приложение" },
      { command: "new", description: "Создать заявку" },
      { command: "orders", description: "Мои заказы" },
      { command: "pro", description: "Кабинет исполнителя" },
      { command: "help", description: "Как это работает" },
      { command: "paysupport", description: "Вопросы по оплате" },
    ],
  });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть", web_app: { url } } });
  await call("setMyDescription", { description: "Услуги рядом с вами: мастера и специалисты Саратова. Опишите задачу — исполнители сами предложат цену и время. Без комиссии: вы платите мастеру напрямую." });
  await call("setMyShortDescription", { short_description: "Мастера и специалисты Саратова рядом с вами. Бесплатно и без комиссии." });
  console.log(`✓ telegram bot @${me.username}: webhook ${url}/api/telegram/webhook, menu button, commands`);
}

main().catch((e) => {
  // never block the app from starting because Telegram is unreachable or misconfigured
  console.error("! telegram setup failed:", e instanceof Error ? e.message : e);
});
