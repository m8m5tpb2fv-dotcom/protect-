import { z } from "zod";

/** Shared input schemas — used by API routes (authoritative) and forms (UX). */

const trimmed = (min: number, max: number, msg?: string) =>
  z
    .string()
    .trim()
    .min(min, msg ?? `Минимум ${min} символа`)
    .max(max, `Максимум ${max} символов`);

export const emailSchema = z.string().trim().toLowerCase().email("Проверьте email").max(254);
export const passwordSchema = z.string().min(8, "Пароль — минимум 8 символов").max(128);
export const nameSchema = trimmed(2, 60, "Укажите имя");

export const registerSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Введите пароль").max(128) });
export const phoneRequestSchema = z.object({ phone: z.string().min(10).max(20) });
export const phoneVerifySchema = z.object({ phone: z.string().min(10).max(20), code: z.string().regex(/^\d{6}$/, "Код — 6 цифр"), name: nameSchema.optional() });
export const telegramAuthSchema = z.object({ initData: z.string().min(10).max(8192) });

export const urgencyValues = ["urgent", "today", "week", "flexible"] as const;

const imageUrl = z
  .string()
  .max(500)
  .regex(/^\/(files|art)\/[\w\-./?=&%]+$/, "Недопустимый адрес файла");

export const createOrderSchema = z.object({
  subcategoryId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive().nullish(),
  title: trimmed(3, 120, "Коротко опишите задачу"),
  description: trimmed(10, 3000, "Опишите задачу подробнее — хотя бы пару предложений"),
  address: trimmed(3, 200, "Укажите адрес"),
  districtId: z.coerce.number().int().positive().nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  urgency: z.enum(urgencyValues),
  budget: z.coerce.number().int().min(0).max(10_000_000).nullish(),
  contactPhone: z.string().max(20).nullish(),
  photos: z.array(imageUrl).max(8).default([]),
  directProviderId: z.string().uuid().nullish(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const respondSchema = z.object({
  message: trimmed(5, 1500, "Напишите пару слов клиенту"),
  price: z.coerce.number().int().min(0).max(10_000_000).nullish(),
  eta: z.string().trim().max(60).nullish(),
});

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("choose"), responseId: z.string().uuid() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete"), finalPrice: z.coerce.number().int().min(0).max(10_000_000).nullish() }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("accept") }), // provider accepts a direct order
  z.object({ action: z.literal("decline") }), // provider declines a direct order
  z.object({ action: z.literal("delete") }), // client removes the order from their list (cancelling it first if still active)
]);

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(2000).default(""),
  photos: z.array(imageUrl).max(6).default([]),
});

export const messageSchema = z
  .object({
    body: z.string().trim().max(4000).default(""),
    attachments: z.array(z.object({ url: imageUrl, width: z.number().int().optional(), height: z.number().int().optional() })).max(6).default([]),
  })
  .refine((m) => m.body.length > 0 || m.attachments.length > 0, "Пустое сообщение");

export const startConversationSchema = z.object({ providerId: z.string().uuid(), orderId: z.string().uuid().nullish(), body: z.string().trim().max(4000).optional() });

const timeRange = z.object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) }).nullable();
export const scheduleSchema = z.object({ mon: timeRange, tue: timeRange, wed: timeRange, thu: timeRange, fri: timeRange, sat: timeRange, sun: timeRange });

export const providerProfileSchema = z.object({
  displayName: trimmed(2, 80, "Укажите имя или название"),
  kind: z.enum(["person", "company"]).default("person"),
  headline: trimmed(5, 120, "Коротко: чем вы занимаетесь"),
  bio: z.string().trim().max(3000).default(""),
  primarySubcategoryId: z.coerce.number().int().positive(),
  subcategoryIds: z.array(z.coerce.number().int().positive()).max(5).default([]),
  districtId: z.coerce.number().int().positive().nullish(),
  radiusKm: z.coerce.number().int().min(1).max(100).default(10),
  worksCityWide: z.boolean().default(false),
  experienceYears: z.coerce.number().int().min(0).max(70).default(0),
  priceFrom: z.coerce.number().int().min(0).max(10_000_000).nullish(),
  phone: z.string().trim().max(20).nullish(),
  telegram: z
    .string()
    .trim()
    .max(40)
    .regex(/^@?[A-Za-z0-9_]{0,32}$/, "Ник в Telegram: латиница, цифры и _")
    .nullish(),
  showPhone: z.boolean().default(true),
  avatarUrl: imageUrl.nullish(),
  coverUrl: imageUrl.nullish(),
  schedule: scheduleSchema.nullish(),
});
export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;

export const providerServiceSchema = z.object({
  title: trimmed(2, 120),
  description: z.string().trim().max(500).default(""),
  priceFrom: z.coerce.number().int().min(0).max(10_000_000),
  priceTo: z.coerce.number().int().min(0).max(10_000_000).nullish(),
  unit: z.string().trim().min(1).max(40).default("за услугу"),
  serviceId: z.coerce.number().int().positive().nullish(),
});

export const portfolioSchema = z.object({ url: imageUrl, width: z.number().int().min(1).max(10000), height: z.number().int().min(1).max(10000), caption: z.string().trim().max(200).default("") });

export const reportSchema = z.object({
  targetType: z.enum(["provider", "review", "order", "message", "user"]),
  targetId: z.string().min(1).max(64),
  reason: trimmed(3, 120),
  text: z.string().trim().max(2000).default(""),
});

export const ticketSchema = z.object({ subject: trimmed(3, 120), body: trimmed(10, 4000), email: emailSchema.optional() });

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  districtId: z.coerce.number().int().positive().nullish(),
  avatarUrl: imageUrl.nullish(),
  notifyEmail: z.boolean().optional(),
  notifyTelegram: z.boolean().optional(),
});

export const serviceRequestSchema = z.object({ productId: z.string().min(1).max(40), promoCode: z.string().trim().toUpperCase().max(40).optional() });

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().max(60).optional(),
  sub: z.string().max(60).optional(),
  district: z.string().max(60).optional(),
  sort: z.enum(["relevance", "rating", "price", "distance", "reviews"]).optional(),
  available: z.enum(["1"]).optional(),
  verified: z.enum(["1"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
