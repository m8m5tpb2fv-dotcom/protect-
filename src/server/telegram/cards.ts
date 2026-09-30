import "server-only";
import { URGENCY } from "@/lib/format";
import { escapeHtml, webAppUrl, type ReplyMarkup } from "./bot";

export type OrderCardInput = {
  id: string;
  title: string;
  description: string;
  urgency: keyof typeof URGENCY;
  budget: number | null;
  subName: string;
  districtName: string | null;
  distanceKm: number | null;
  photos: number;
  direct: boolean;
};

const URGENCY_ICON = { urgent: "🔥", today: "⏱", week: "📅", flexible: "🗓" } as const;
const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Callback payloads (≤ 64 bytes). */
export const SKIP_ORDER = "skip";

/**
 * New-order card for providers: what, where, when, budget — enough to decide without opening the app.
 * «Откликнуться» opens the order inside the Mini App, «Не интересно» hides it from the provider's feed.
 * The client's exact address and contacts are never included (they are revealed only after assignment).
 */
export function newOrderCard(o: OrderCardInput): { text: string; markup: ReplyMarkup } {
  const place = [o.districtName, o.distanceKm != null ? `${o.distanceKm.toFixed(1).replace(".", ",")} км от вас` : null].filter(Boolean).join(" · ");
  const lines = [
    `${o.direct ? "👤 <b>Заказ лично вам</b>" : "🆕 <b>Новая заявка рядом</b>"} · ${escapeHtml(o.subName)}`,
    "",
    `<b>${escapeHtml(o.title)}</b>`,
    escapeHtml(clip(o.description.replace(/\s+/g, " ").trim(), 220)),
    "",
    place ? `📍 ${escapeHtml(place)}` : null,
    `${URGENCY_ICON[o.urgency]} ${URGENCY[o.urgency].label} · ${o.budget ? `бюджет до ${rub(o.budget)}` : "бюджет не указан"}`,
    o.photos ? `📷 ${o.photos} фото` : null,
  ].filter((l) => l !== null);
  const open = { text: o.direct ? "Посмотреть и ответить" : "✍️ Откликнуться", web_app: { url: webAppUrl(`/orders/${o.id}`) } };
  return {
    text: lines.join("\n"),
    markup: { inline_keyboard: o.direct ? [[open]] : [[open], [{ text: "Не интересно", callback_data: `${SKIP_ORDER}:${o.id}` }]] },
  };
}

/* ------------------------------------------------------------ response card for the client */

export const PICK = "pick"; // → confirmation
export const PICK_OK = "pickok"; // → choose this provider
export const PICK_BACK = "pickno"; // → back to the card

export type ResponseCardInput = {
  responseId: string;
  orderId: string;
  orderTitle: string;
  providerName: string;
  ratingAvg: number;
  reviewsCount: number;
  ordersCompleted: number;
  price: number | null;
  eta: string | null;
  message: string;
  conversationId: string;
  responsesCount: number;
};

/**
 * «Новый отклик» for the client: who, rating, price, time and the message — with «Выбрать» (asks for a
 * confirmation first, because choosing declines the other responses), «Написать» and «Все отклики».
 */
export function responseCard(r: ResponseCardInput): { text: string; markup: ReplyMarkup } {
  const rating = r.reviewsCount ? `★ ${r.ratingAvg.toFixed(1).replace(".", ",")} · ${r.reviewsCount} отз.` : "новый исполнитель";
  const lines = [
    `💬 <b>Новый отклик</b> на «${escapeHtml(clip(r.orderTitle, 60))}»`,
    "",
    `<b>${escapeHtml(r.providerName)}</b> · ${rating}${r.ordersCompleted ? ` · ${r.ordersCompleted} заказов` : ""}`,
    [r.price ? `💰 ${rub(r.price)}` : "💰 цена после осмотра", r.eta ? `⏱ ${escapeHtml(clip(r.eta, 40))}` : null].filter(Boolean).join("  ·  "),
    "",
    `<i>${escapeHtml(clip(r.message.replace(/\s+/g, " ").trim(), 300))}</i>`,
    r.responsesCount > 1 ? `\nВсего откликов: ${r.responsesCount}` : null,
  ].filter((l) => l !== null);
  return {
    text: lines.join("\n"),
    markup: {
      inline_keyboard: [
        [{ text: "✅ Выбрать", callback_data: `${PICK}:${r.responseId}` }, { text: "💬 Написать", web_app: { url: webAppUrl(`/messages/${r.conversationId}`) } }],
        [{ text: "Все отклики", web_app: { url: webAppUrl(`/orders/${r.orderId}`) } }],
      ],
    },
  };
}

export function confirmPickCard(r: Pick<ResponseCardInput, "responseId" | "providerName" | "price" | "orderTitle" | "responsesCount">): { text: string; markup: ReplyMarkup } {
  const others = r.responsesCount > 1 ? "\nОстальные отклики на эту заявку будут закрыты." : "";
  return {
    text: `Выбрать <b>${escapeHtml(r.providerName)}</b>${r.price ? ` за ${rub(r.price)}` : ""} для «${escapeHtml(clip(r.orderTitle, 60))}»?\n\nИсполнитель увидит ваш адрес и контакты, дальше договариваетесь напрямую.${others}`,
    markup: { inline_keyboard: [[{ text: "Да, выбрать", callback_data: `${PICK_OK}:${r.responseId}` }, { text: "Назад", callback_data: `${PICK_BACK}:${r.responseId}` }]] },
  };
}
