import "server-only";
import { eq } from "drizzle-orm";
import { APP } from "@/config/app";
import { decodeStartParam } from "@/lib/deeplink";
import { db } from "../db";
import { providers, users } from "../db/schema";
import { dismissOrder, orderAction, responseCardData } from "../services/orders";
import { PICK, PICK_BACK, PICK_OK, SKIP_ORDER, confirmPickCard, responseCard } from "./cards";
import { userByTelegramId } from "../auth/session";
import { AppError } from "../http/errors";
import { answerCallback, answerPreCheckout, editMessage, escapeHtml, sendMessage, webAppUrl } from "./bot";
import { completeStarsPayment, starsPreCheckoutError } from "../billing";
import { getProduct } from "@/config/monetization";
import { confirmTelegramLogin, describeDevice, findPendingLogin, parseLoginStartParam, rejectTelegramLogin } from "../auth/telegram-login";

type TgUser = { id: number; first_name: string; last_name?: string; username?: string; is_bot?: boolean };
type Update = {
  update_id: number;
  message?: { message_id: number; text?: string; chat: { id: number; type: string }; from?: TgUser; successful_payment?: SuccessfulPayment };
  pre_checkout_query?: { id: string; from: TgUser; currency: string; total_amount: number; invoice_payload: string };
  my_chat_member?: { chat: { id: number }; from: { id: number }; new_chat_member: { status: string } };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } };
};

type SuccessfulPayment = { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string };

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

/**
 * «Выбрать» under a response card → confirmation → choose. Only the client who owns the order can do it
 * (matched by the Telegram id Telegram put into the update); the choice itself goes through orderAction,
 * i.e. the same checks as on the website.
 */
async function pickResponse(q: NonNullable<Update["callback_query"]>, action: string, responseId: string) {
  const [user, data] = await Promise.all([userByTelegramId(q.from.id), responseCardData(responseId)]);
  // UI updates must never abort the flow (e.g. «message is not modified», an expired callback)
  const edit = (text: string, markup?: Parameters<typeof editMessage>[3]) => (q.message ? editMessage(q.message.chat.id, q.message.message_id, text, markup).catch(() => null) : null);
  const answer = (text?: string) => answerCallback(q.id, text).catch(() => null);
  if (!user || !data || data.clientId !== user.id) {
    await answer("Запрос устарел");
    return;
  }
  const chat = { inline_keyboard: [[{ text: "💬 Написать", web_app: { url: webAppUrl(`/messages/${data.conversationId}`) } }, { text: "Открыть заявку", web_app: { url: webAppUrl(`/orders/${data.orderId}`) } }]] };
  const open = data.status === "pending" && (data.orderStatus === "new" || data.orderStatus === "responses");
  if (action !== PICK_OK && !open) {
    await answer("Отклик уже неактуален");
    await edit(data.status === "accepted" ? `✅ Вы выбрали <b>${escapeHtml(data.providerName)}</b>.` : `Отклик от <b>${escapeHtml(data.providerName)}</b> уже неактуален.`, chat);
    return;
  }
  if (action === PICK) {
    await answer();
    await edit(confirmPickCard(data).text, confirmPickCard(data).markup);
    return;
  }
  if (action === PICK_BACK) {
    await answer();
    const card = responseCard(data);
    await edit(card.text, card.markup);
    return;
  }
  if (data.status === "accepted") {
    await answer("Этот исполнитель уже выбран");
    return;
  }
  try {
    await orderAction(user, data.orderId, { action: "choose", responseId });
  } catch (e) {
    await answer(e instanceof AppError ? e.message : "Не получилось. Попробуйте в приложении.");
    if (e instanceof AppError) await edit(`${escapeHtml(e.message)}.`, chat);
    return;
  }
  await answer("Исполнитель выбран");
  await edit(`✅ Вы выбрали <b>${escapeHtml(data.providerName)}</b>${data.price ? ` за ${data.price.toLocaleString("ru-RU")} ₽` : ""}.\n\nИсполнитель получил уведомление. Договоритесь о времени в чате — оплата напрямую исполнителю, без комиссии.`, chat);
}

async function handleCallback(q: NonNullable<Update["callback_query"]>) {
  const [action, id] = (q.data ?? "").split(":");
  const valid = !!id && /^[0-9a-f-]{36}$/.test(id) && !q.from.is_bot;
  if (valid && action === SKIP_ORDER) return skipOrder(q, id);
  if (valid && (action === PICK || action === PICK_OK || action === PICK_BACK)) return pickResponse(q, action, id);
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

async function handlePreCheckout(q: NonNullable<Update["pre_checkout_query"]>) {
  let error: string | null;
  try {
    error = await starsPreCheckoutError({ fromTelegramId: q.from.id, currency: q.currency, totalAmount: q.total_amount, payload: q.invoice_payload });
  } catch {
    error = "Не получилось проверить счёт. Попробуйте ещё раз.";
  }
  await answerPreCheckout(q.id, error);
}

async function handlePayment(chatId: number, from: TgUser, p: SuccessfulPayment) {
  const inv = await completeStarsPayment({ fromTelegramId: from.id, currency: p.currency, totalAmount: p.total_amount, payload: p.invoice_payload, chargeId: p.telegram_payment_charge_id });
  const title = inv ? (getProduct(inv.productId)?.title ?? "Услуга") : null;
  await sendMessage(
    chatId,
    title ? `✅ <b>${escapeHtml(title)}</b> подключено. Спасибо!\n\nНовые заявки рядом будут приходить сюда сразу.` : "Оплата получена, но мы не смогли сразу подключить услугу. Мы уже разбираемся — напишите /paysupport, если вопрос срочный.",
    openBtn("Открыть кабинет", "/pro/billing"),
  );
}

export async function handleUpdate(u: Update) {
  if (u.callback_query) return handleCallback(u.callback_query);
  if (u.pre_checkout_query) return handlePreCheckout(u.pre_checkout_query);
  if (u.message?.successful_payment && u.message.from) return handlePayment(u.message.chat.id, u.message.from, u.message.successful_payment);
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
    case "/paysupport":
      await sendMessage(
        m.chat.id,
        `<b>Вопросы по оплате</b>\n\nЗвёздами оплачивается только «Продвижение» для исполнителей. Если услуга не включилась или вы хотите вернуть оплату — напишите в поддержку по кнопке ниже и укажите дату платежа. Ответим в течение дня.`,
        openBtn("Написать в поддержку", "/support"),
      );
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
