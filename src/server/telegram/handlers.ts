import "server-only";
import { eq } from "drizzle-orm";
import { APP } from "@/config/app";
import { decodeStartParam } from "@/lib/deeplink";
import { db } from "../db";
import { users } from "../db/schema";
import { sendMessage, webAppUrl } from "./bot";

type Update = {
  update_id: number;
  message?: { message_id: number; text?: string; chat: { id: number; type: string }; from?: { id: number; first_name: string; username?: string } };
  my_chat_member?: { chat: { id: number }; from: { id: number }; new_chat_member: { status: string } };
};

const openBtn = (text: string, path: string) => ({ inline_keyboard: [[{ text, web_app: { url: webAppUrl(path) } }]] });

export async function handleUpdate(u: Update) {
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
