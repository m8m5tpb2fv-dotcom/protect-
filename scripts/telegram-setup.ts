import "dotenv/config";

/**
 * Configures the bot: webhook, commands, menu button (opens the Mini App).
 * Usage: npm run telegram:setup
 */
async function call(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const json = await res.json();
  console.log(method, json.ok ? "✓" : json);
  return json;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = process.env.APP_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !url || !secret) throw new Error("Set TELEGRAM_BOT_TOKEN, APP_URL (https) and TELEGRAM_WEBHOOK_SECRET");
  if (!url.startsWith("https://")) throw new Error("APP_URL must be https for Telegram");
  await call("setWebhook", { url: `${url}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message", "my_chat_member"], drop_pending_updates: true });
  await call("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть приложение" },
      { command: "new", description: "Создать заявку" },
      { command: "orders", description: "Мои заказы" },
      { command: "pro", description: "Кабинет исполнителя" },
    ],
  });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть", web_app: { url } } });
  await call("setMyDescription", { description: "Услуги рядом с вами: мастера и специалисты Саратова. Опишите задачу — получите отклики за минуты." });
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
