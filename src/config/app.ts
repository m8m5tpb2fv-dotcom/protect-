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
  url: process.env.NEXT_PUBLIC_APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000"),
  telegramBot: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "",
  telegramAppName: process.env.NEXT_PUBLIC_TELEGRAM_APP_NAME || "app",
  currency: "RUB",
} as const;
