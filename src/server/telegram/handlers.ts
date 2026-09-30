import "server-only";
import { eq } from "drizzle-orm";
import { APP } from "@/config/app";
import { decodeStartParam } from "@/lib/deeplink";
import { db } from "../db";
import { providers, users } from "../db/schema";
import { dismissOrder } from "../services/orders";
import { SKIP_ORDER } from "./cards";
import { answerCallback, editMessage, escapeHtml, sendMessage, webAppUrl } from "./bot";
import { confirmTelegramLogin, describeDevice, findPendingLogin, parseLoginStartParam, rejectTelegramLogin } from "../auth/telegram-login";

type TgUser = { id: number; first_name: string; last_name?: string; username?: string; is_bot?: boolean };
type Update = {
  update_id: number;
  message?: { message_id: number; text?: string; chat: { id: number; type: string }; from?: TgUser };
  my_chat_member?: { chat: { id: number }; from: { id: number }; new_chat_member: { status: string } };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } };
};

const fmtTime = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Saratov" });

/** «Войти через Telegram» on the website: show the request and ask for an explicit confirmation. */
async function askLoginConfirmation(chatId: number, token: string) {
  const r = await findPendingLogin(token);
  if (!r) {
    await sendMessage(chatId, "Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.");
    return;
  }
  await sendMessage(
    chatId,
    `<b>Вход на сайт ${escapeHtml(APP.name)}</b>\n\nЗапрос в ${fmtTime(r.createdAt)} с устройства: ${escapeHtml(describeDevice(r.userAgent))}.\n\nПодтверждайте, только если вы сами нажали «Войти через Telegram» на сайте. Если ссылку прислал кто-то другой — нажмите «Это не я».`,
    { inline_keyboard: [[{ text: "✅ Войти", callback_data: `login:${r.id}` }, { text: "Это не я", callback_data: `nologin:${r.id}` }]] },
  );
}

/** «Не интересно» under a new-order card: hide it from this provider's feed and collapse the message. */
async function skipOrder(q: NonNullable<Update["callback_query"]>, orderId: string) {
  const [row] = await db
    .select({ providerId: providers.id })
    .from(users)
    .innerJoin(providers, eq(providers.userId, users.id))
    .where(eq(users.telegramId, String(q.from.id)));
  if (!row) {
    await answerCallback(q.id, "Профиль исполнителя не найден");
    return;
  }
  const o = await dismissOrder(row.providerId, orderId);
  await answerCallback(q.id, "Скрыли из ленты");
  if (q.message) await editMessage(q.message.chat.id, q.message.message_id, `🙈 Скрыто: «${escapeHtml(o.title)}»\nЗаявка больше не появится в вашей ленте.`);
}

async function handleCallback(q: NonNullable<Update["callback_query"]>) {
  const [action, id] = (q.data ?? "").split(":");
  const valid = !!id && /^[0-9a-f-]{36}$/.test(id) && !q.from.is_bot;
  if (valid && action === SKIP_ORDER) return skipOrder(q, id);
  let reply = "Запрос устарел";
  let text: string | null = null;
  if (valid && action === "login") {
    const user = await confirmTelegramLogin(id, q.from);
    reply = user ? "Готово" : reply;
    text = user ? "✅ Вход подтверждён. Вернитесь в браузер — сайт откроется сам." : "Ссылка для входа устарела. Нажмите «Войти через Telegram» на сайте ещё раз.";
  } else if (valid && action === "nologin") {
    await rejectTelegramLogin(id);
    reply = "Вход отклонён";
    text = "Вход отклонён. Никто не получил доступ к вашему аккаунту.";
  }
  await answerCallback(q.id, reply);
  if (text && q.message) await editMessage(q.message.chat.id, q.message.message_id, text);
}

const openBtn = (text: string, path: string) => ({ inline_keyboard: [[{ text, web_app: { url: webAppUrl(path) } }]] });

export async function handleUpdate(u: Update) {
  if (u.callback_query) return handleCallback(u.callback_query);
  if (u.my_chat_member) {
    const blocked = u.my_chat_member.new_chat_member.status === "kicked";
    await db.update(users).set({ telegramChatAllowed: !blocked }).where(eq(users.telegramId, String(u.my_chat_member.from.id)));
    return;
  }
  const m = u.message;
  if (!m?.text || m.chat.type !== "private" || !m.from) return;
  const [cmd, payload] = m.text.trim().split(/\s+/, 2);
  // the user talked to the bot → we may message them
  await db.update(users).set({ telegramChatAllowed: true }).where(eq(users.telegramId, String(m.from.id)));

  switch (cmd) {
    case "/start": {
      const loginToken = parseLoginStartParam(payload);
      if (loginToken) return askLoginConfirmation(m.chat.id, loginToken);
      const path = decodeStartParam(payload) ?? "/";
      const text =
        path === "/"
          ? `<b>${APP.name}</b> — ${APP.tagline.toLowerCase()} в Саратове.\n\nОпишите задачу, и мастера рядом сами предложат цену и время. Уведомления об откликах и сообщениях будут приходить сюда.`
          : `Открываю в ${APP.name} 👇`;
      await sendMessage(m.chat.id, text, openBtn(path === "/" ? "Открыть приложение" : "Открыть", path));
      return;
    }
    case "/orders":
      await sendMessage(m.chat.id, "Ваши заказы:", openBtn("Мои заказы", "/orders"));
      return;
    case "/new":
      await sendMessage(m.chat.id, "Создайте заявку — исполнители ответят за несколько минут.", openBtn("Создать заявку", "/order/new"));
      return;
    case "/pro":
      await sendMessage(m.chat.id, "Кабинет исполнителя: заявки рядом, отклики и заказы.", openBtn("Открыть кабинет", "/pro"));
      return;
    case "/help":
      await sendMessage(
        m.chat.id,
        `<b>Как это работает</b>\n\n1. Опишите задачу — мастера рядом получат уведомление.\n2. Сравните отклики: цена, сроки, рейтинг и отзывы.\n3. Выберите исполнителя и договоритесь в чате.\n\nСервис бесплатный и без комиссии: вы платите мастеру напрямую.\n\n/new — создать заявку\n/orders — мои заказы\n/pro — кабинет исполнителя`,
        openBtn("Открыть приложение", "/"),
      );
      return;
    default:
      await sendMessage(m.chat.id, "Все функции — в приложении 👇\n/new — создать заявку\n/orders — мои заказы\n/pro — кабинет исполнителя", openBtn("Открыть приложение", "/"));
  }
}
