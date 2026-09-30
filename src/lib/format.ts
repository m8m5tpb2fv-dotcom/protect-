/** Formatting helpers shared by server and client. Russian locale. */

export function plural(n: number, forms: [one: string, few: string, many: string]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const pl = (n: number, forms: [string, string, string]) => `${n.toLocaleString("ru-RU")} ${plural(n, forms)}`;

export function rub(n: number | null | undefined) {
  if (n == null) return "";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

export function priceFrom(n: number | null | undefined) {
  return n == null ? "Цена по договорённости" : `от ${rub(n)}`;
}

export function km(n: number | null | undefined) {
  if (n == null) return "";
  if (n < 1) return `${Math.max(100, Math.round((n * 1000) / 50) * 50)} м`;
  return `${n.toFixed(1).replace(".", ",")} км`;
}

export function responseTime(min: number | null | undefined) {
  if (min == null) return null;
  if (min < 60) return `Ответ обычно за ${pl(min, ["минуту", "минуты", "минут"])}`;
  const h = Math.round(min / 60);
  return `Ответ обычно за ${pl(h, ["час", "часа", "часов"])}`;
}

export function rating(n: number) {
  return n.toFixed(1).replace(".", ",");
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function dateShort(d: Date | string) {
  const x = new Date(d);
  const now = new Date();
  return `${x.getDate()} ${MONTHS[x.getMonth()]}${x.getFullYear() !== now.getFullYear() ? ` ${x.getFullYear()}` : ""}`;
}

export function time(d: Date | string) {
  return new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Saratov" });
}

export function relative(d: Date | string, now = Date.now()) {
  const x = new Date(d).getTime();
  const diff = Math.round((now - x) / 1000);
  if (diff < 45) return "только что";
  if (diff < 3600) return `${pl(Math.round(diff / 60), ["минуту", "минуты", "минут"])} назад`;
  if (diff < 86400) return `${pl(Math.round(diff / 3600), ["час", "часа", "часов"])} назад`;
  if (diff < 86400 * 2) return "вчера";
  if (diff < 86400 * 7) return `${pl(Math.round(diff / 86400), ["день", "дня", "дней"])} назад`;
  return dateShort(d);
}

export const URGENCY = {
  urgent: { label: "Срочно", hint: "в течение пары часов" },
  today: { label: "Сегодня", hint: "до конца дня" },
  week: { label: "На неделе", hint: "в ближайшие дни" },
  flexible: { label: "Не срочно", hint: "когда будет удобно" },
} as const;

export const ORDER_STATUS: Record<string, { label: string; tone: "accent" | "info" | "neutral" | "success" | "danger" | "warning" }> = {
  new: { label: "Новая заявка", tone: "info" },
  responses: { label: "Есть отклики", tone: "accent" },
  assigned: { label: "Исполнитель выбран", tone: "warning" },
  in_progress: { label: "В работе", tone: "warning" },
  completed: { label: "Завершён", tone: "success" },
  cancelled: { label: "Отменён", tone: "neutral" },
};

export const VERIFICATION = {
  none: null,
  verified: { label: "Документы проверены", short: "Проверен" },
  pro: { label: "Профессионал платформы", short: "Профи" },
  business: { label: "Проверенный бизнес", short: "Бизнес" },
} as const;

/** True when the date is in the future (subscription / promotion still active). */
export function isFuture(d: Date | null | undefined) {
  return !!d && new Date(d).getTime() > Date.now();
}

export function initials(name: string) {
  const parts = name.replace(/[«»"]/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}
