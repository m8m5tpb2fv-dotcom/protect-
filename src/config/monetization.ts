/**
 * Monetisation model — see docs/MONETIZATION.md.
 *
 *  - Zero commission. Clients pay providers directly (cash, card, transfer);
 *    money between them never passes through the platform, so orders carry
 *    no commission, balance or payment state.
 *  - Base features are free forever and are never gated (FREE_FOREVER).
 *  - Revenue is optional and comes only from channels that can be switched
 *    off independently: PRO subscription, promotion of a profile, and ads.
 *  - No acquiring for client ↔ provider money. Platform services are paid
 *    either off-platform by invoice (an admin activates them) or, for
 *    «Продвижение», with Telegram Stars inside the bot (activated by the
 *    Bot API payment update).
 */

export const CHANNELS = ["pro", "promotion", "ads"] as const;
export type Channel = (typeof CHANNELS)[number];

/** What every client and provider gets for free. Nothing here may depend on a channel. */
export const FREE_FOREVER = [
  "Создание заказов и отклики — без лимитов",
  "Профиль исполнителя, услуги, цены и портфолио",
  "Чат, контакты после выбора исполнителя, отзывы",
  "Поиск, карта, лента заявок, уведомления в приложении и Telegram Mini App",
  "Никакой комиссии: клиент платит исполнителю напрямую",
] as const;

/** Prices in rubles. */
export const PLANS = {
  pro_month: {
    id: "pro_month",
    channel: "pro",
    title: "Pro",
    description: "Значок Pro в профиле и карточке. На доступ к функциям и место в выдаче не влияет.",
    price: 990,
    periodDays: 30,
  },
} as const;

/**
 * Subscriptions paid with Telegram Stars (currency XTR) — Telegram's required method for digital goods in bots.
 * «Продвижение» buys one thing: instant Telegram cards about new orders nearby. It changes nothing in search,
 * badges or the profile; trust marks (the crown included) come only from moderation.
 */
export const STAR_PLANS = {
  promo_month: {
    id: "promo_month",
    channel: "promotion",
    title: "Продвижение",
    description: "Быстрые уведомления о новых заявках рядом с вами — прямо в Telegram.",
    features: [
      "Новая заявка рядом приходит вам в Telegram сразу, в момент создания",
      "В сообщении — что нужно сделать, район, расстояние, срочность и бюджет",
      "Кнопка «Откликнуться» прямо в сообщении — вы отвечаете клиенту первым",
    ],
    stars: 500,
    periodDays: 30,
  },
} as const;

/** What a provider without «Продвижение» keeps — shown next to the offer so nobody thinks orders are paywalled. */
export const PROMOTION_FREE_NOTE = "Без продвижения все заявки видны в приложении, и откликаться на них можно бесплатно.";

/** Legacy per-period promotions, paid by invoice. Kept for existing records; no longer offered. */
export const PROMOTIONS = {
  boost_24h: { id: "boost_24h", channel: "promotion", title: "Поднятие на 24 часа", description: "Профиль выше в поиске и категории, с пометкой «Реклама».", price: 149, hours: 24 },
  boost_7d: { id: "boost_7d", channel: "promotion", title: "Поднятие на 7 дней", description: "Неделя в верхней части выдачи, с пометкой «Реклама».", price: 690, hours: 24 * 7 },
  highlight_7d: { id: "highlight_7d", channel: "promotion", title: "Выделение карточки", description: "Акцентная рамка и метка «Рекомендуем».", price: 390, hours: 24 * 7 },
} as const;

export type PlanId = keyof typeof PLANS;
export type StarPlanId = keyof typeof STAR_PLANS;
export type PromotionId = keyof typeof PROMOTIONS;
export type ProductId = PlanId | StarPlanId | PromotionId;

/** price is in rubles for RUB and in Stars for XTR. */
export type Product = { id: ProductId; channel: Channel; title: string; description: string; price: number; currency: "RUB" | "XTR"; kind: "subscription" | "promotion" };

export function getProduct(id: string): Product | null {
  if (id in PLANS) {
    const p = PLANS[id as PlanId];
    return { id: p.id, channel: p.channel, title: p.title, description: p.description, price: p.price, currency: "RUB", kind: "subscription" };
  }
  if (id in STAR_PLANS) {
    const p = STAR_PLANS[id as StarPlanId];
    return { id: p.id, channel: p.channel, title: p.title, description: p.description, price: p.stars, currency: "XTR", kind: "subscription" };
  }
  if (id in PROMOTIONS) {
    const p = PROMOTIONS[id as PromotionId];
    return { id: p.id, channel: p.channel, title: p.title, description: p.description, price: p.price, currency: "RUB", kind: "promotion" };
  }
  return null;
}

/** Parses MONETIZATION_CHANNELS ("pro,promotion,ads"; empty or "off" = fully free). */
export function parseChannels(raw: string | undefined): ReadonlySet<Channel> {
  const set = new Set<Channel>();
  for (const part of (raw ?? "").split(",")) {
    const c = part.trim().toLowerCase();
    if ((CHANNELS as readonly string[]).includes(c)) set.add(c as Channel);
  }
  return set;
}
