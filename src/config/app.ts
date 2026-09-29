/**
 * Brand & product configuration.
 * Everything that is "product copy" or a business constant lives here so the
 * project can be renamed / re-tuned without touching components.
 */
export const APP = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Рядом",
  tagline: "Услуги рядом с вами",
  description:
    "Сервис локальных услуг: мастера, специалисты и компании вашего города. Опишите задачу — получите отклики проверенных исполнителей.",
  defaultCitySlug: process.env.NEXT_PUBLIC_DEFAULT_CITY || "saratov",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  telegramBot: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "",
  telegramAppName: process.env.NEXT_PUBLIC_TELEGRAM_APP_NAME || "app",
  /** Platform commission on completed orders, 0..1. */
  commissionRate: Number(process.env.COMMISSION_RATE ?? 0.08),
  currency: "RUB",
} as const;

/** Monetisation catalogue. Prices in rubles. */
export const PLANS = {
  pro_month: {
    id: "pro_month",
    title: "Рядом Pro",
    description: "Значок Pro, приоритет в выдаче, безлимит откликов, аналитика профиля.",
    price: 990,
    periodDays: 30,
  },
} as const;

export const PROMOTIONS = {
  boost_24h: { id: "boost_24h", title: "Поднятие на 24 часа", description: "Профиль выше в поиске и категории.", price: 149, hours: 24 },
  boost_7d: { id: "boost_7d", title: "Поднятие на 7 дней", description: "Неделя в верхней части выдачи.", price: 690, hours: 24 * 7 },
  highlight_7d: { id: "highlight_7d", title: "Выделение карточки", description: "Акцентная рамка и метка «Рекомендуем».", price: 390, hours: 24 * 7 },
} as const;

/** Free responses per month for non-Pro providers. */
export const FREE_RESPONSES_PER_MONTH = 30;

export type PlanId = keyof typeof PLANS;
export type PromotionId = keyof typeof PROMOTIONS;
