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
