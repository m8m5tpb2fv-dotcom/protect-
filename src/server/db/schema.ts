import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────────────────────── enums ───────────────────────────── */

export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);
export const providerStatus = pgEnum("provider_status", ["draft", "pending", "active", "rejected", "suspended"]);
export const verificationLevel = pgEnum("verification_level", ["none", "verified", "pro", "business"]);
export const orderStatus = pgEnum("order_status", [
  "new", // created, waiting for responses
  "responses", // has at least one response
  "assigned", // client picked a provider
  "in_progress",
  "completed",
  "cancelled",
]);
export const urgency = pgEnum("urgency", ["urgent", "today", "week", "flexible"]);
export const responseStatus = pgEnum("response_status", ["pending", "accepted", "declined", "withdrawn"]);
export const messageKind = pgEnum("message_kind", ["text", "image", "system", "file", "voice", "location"]);
/** Paid platform service (PRO / promotion) paid by invoice outside the platform, activated by an admin. */
export const invoiceStatus = pgEnum("invoice_status", ["requested", "activated", "cancelled"]);
export const adSlot = pgEnum("ad_slot", ["home", "category", "search"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "rejected"]);
export const ticketStatus = pgEnum("ticket_status", ["open", "answered", "closed"]);
export const portfolioKind = pgEnum("portfolio_kind", ["image", "video"]);
export const reviewStatus = pgEnum("review_status", ["visible", "hidden"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();

/* ───────────────────────────── geography ───────────────────────────── */

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameIn: text("name_in").notNull(), // "в Саратове"
  region: text("region").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  timezone: text("timezone").notNull().default("Europe/Saratov"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const districts = pgTable(
  "districts",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("districts_city_slug").on(t.cityId, t.slug)],
);

/* ───────────────────────────── users & auth ───────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    emailVerifiedAt: ts("email_verified_at"),
    phone: text("phone"),
    phoneVerifiedAt: ts("phone_verified_at"),
    passwordHash: text("password_hash"),
    telegramId: text("telegram_id"),
    telegramUsername: text("telegram_username"),
    telegramChatAllowed: boolean("telegram_chat_allowed").notNull().default(false),
    avatarUrl: text("avatar_url"),
    role: userRole("role").notNull().default("user"),
    cityId: integer("city_id").references(() => cities.id),
    districtId: integer("district_id").references(() => districts.id),
    notifyTelegram: boolean("notify_telegram").notNull().default(true),
    notifyEmail: boolean("notify_email").notNull().default(true),
    isBlocked: boolean("is_blocked").notNull().default(false),
    lastSeenAt: ts("last_seen_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    uniqueIndex("users_phone_unique").on(t.phone),
    uniqueIndex("users_telegram_unique").on(t.telegramId),
    index("users_created_idx").on(t.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    method: text("method").notNull(), // email | phone | telegram | demo
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * "Войти через Telegram" on the website: the browser gets a one-time link to the bot,
 * the user confirms inside Telegram, the same browser (proven by a nonce cookie) receives a session.
 * Only hashes of the link token and the browser nonce are stored.
 */
export const loginRequests = pgTable(
  "login_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    status: text("status").notNull().default("pending"), // pending | confirmed | used | rejected
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: ts("expires_at").notNull(),
    confirmedAt: ts("confirmed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("login_requests_token_idx").on(t.tokenHash)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target").notNull(), // normalised phone
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_target_idx").on(t.target)],
);

/** Saved addresses. */
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  address: text("address").notNull(),
  cityId: integer("city_id").notNull().references(() => cities.id),
  districtId: integer("district_id").references(() => districts.id),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: createdAt(),
});

/* ───────────────────────────── catalogue ───────────────────────────── */

/** Top-level groups: Ремонт, Дом, Авто … */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").notNull(), // lucide icon name
  emoji: text("emoji").notNull(),
  tone: text("tone").notNull(), // key of the illustration palette
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/** Specialities: Сантехник, Электрик … */
export const subcategories = pgTable(
  "subcategories",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(), // "Сантехник"
    namePlural: text("name_plural").notNull(), // "Сантехники"
    icon: text("icon").notNull(),
    keywords: text("keywords").notNull().default(""), // space separated search synonyms
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("subcategories_category_idx").on(t.categoryId)],
);

/** Concrete task templates: «Устранить протечку». */
export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    subcategoryId: integer("subcategory_id").notNull().references(() => subcategories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    keywords: text("keywords").notNull().default(""),
    priceFrom: integer("price_from"),
    unit: text("unit"), // "за выезд", "за час"
    isPopular: boolean("is_popular").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("services_sub_idx").on(t.subcategoryId)],
);

/* ───────────────────────────── providers ───────────────────────────── */

export type WeeklySchedule = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", { from: string; to: string } | null>;

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    kind: text("kind").notNull().default("person"), // person | company
    headline: text("headline").notNull(),
    bio: text("bio").notNull().default(""),
    primarySubcategoryId: integer("primary_subcategory_id").notNull().references(() => subcategories.id),
    cityId: integer("city_id").notNull().references(() => cities.id),
    districtId: integer("district_id").references(() => districts.id),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    radiusKm: integer("radius_km").notNull().default(10),
    worksCityWide: boolean("works_city_wide").notNull().default(false),
    experienceYears: integer("experience_years").notNull().default(0),
    priceFrom: integer("price_from"),
    phone: text("phone"),
    telegram: text("telegram"),
    showPhone: boolean("show_phone").notNull().default(true),
    avatarUrl: text("avatar_url"),
    coverUrl: text("cover_url"),
    schedule: jsonb("schedule").$type<WeeklySchedule>(),
    status: providerStatus("status").notNull().default("draft"),
    moderationNote: text("moderation_note"),
    verification: verificationLevel("verification").notNull().default("none"),
    isAvailable: boolean("is_available").notNull().default(true),
    // denormalised stats (maintained by services/stats.ts)
    ratingAvg: doublePrecision("rating_avg").notNull().default(0),
    reviewsCount: integer("reviews_count").notNull().default(0),
    ordersCompleted: integer("orders_completed").notNull().default(0),
    clientsCount: integer("clients_count").notNull().default(0),
    repeatClientsPct: integer("repeat_clients_pct").notNull().default(0),
    responseTimeMin: integer("response_time_min"),
    // monetisation
    proUntil: ts("pro_until"),
    boostedUntil: ts("boosted_until"),
    highlightedUntil: ts("highlighted_until"),
    searchText: text("search_text").notNull().default(""),
    createdAt: createdAt(),
    approvedAt: ts("approved_at"),
  },
  (t) => [
    index("providers_status_idx").on(t.status),
    index("providers_sub_idx").on(t.primarySubcategoryId),
    index("providers_city_idx").on(t.cityId),
    index("providers_search_trgm").using("gin", sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const providerSubcategories = pgTable(
  "provider_subcategories",
  {
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    subcategoryId: integer("subcategory_id").notNull().references(() => subcategories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.providerId, t.subcategoryId] }), index("ps_sub_idx").on(t.subcategoryId)],
);

export const providerDistricts = pgTable(
  "provider_districts",
  {
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.providerId, t.districtId] })],
);

/** Price list items of a provider. */
export const providerServices = pgTable(
  "provider_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priceFrom: integer("price_from").notNull(),
    priceTo: integer("price_to"),
    unit: text("unit").notNull().default("за услугу"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("provider_services_provider_idx").on(t.providerId)],
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    kind: portfolioKind("kind").notNull().default("image"),
    url: text("url").notNull(),
    thumbUrl: text("thumb_url"),
    width: integer("width").notNull().default(1200),
    height: integer("height").notNull().default(900),
    caption: text("caption").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("portfolio_provider_idx").on(t.providerId)],
);

/** Identity / licence documents. Stored privately; only admins can open them. */
export const providerDocuments = pgTable("provider_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // passport | diploma | business | other
  fileKey: text("file_key").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: createdAt(),
});

/* ───────────────────────────── orders ───────────────────────────── */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(),
    clientId: uuid("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cityId: integer("city_id").notNull().references(() => cities.id),
    districtId: integer("district_id").references(() => districts.id),
    subcategoryId: integer("subcategory_id").notNull().references(() => subcategories.id),
    serviceId: integer("service_id").references(() => services.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    address: text("address").notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    urgency: urgency("urgency").notNull().default("week"),
    budget: integer("budget"),
    contactPhone: text("contact_phone"),
    status: orderStatus("status").notNull().default("new"),
    /** When the order was created from a provider profile it is sent to that provider only. */
    directProviderId: uuid("direct_provider_id").references(() => providers.id, { onDelete: "set null" }),
    providerId: uuid("provider_id").references(() => providers.id, { onDelete: "set null" }),
    /** Informational only: the client pays the provider directly, the platform takes no commission. */
    agreedPrice: integer("agreed_price"),
    cancelReason: text("cancel_reason"),
    /** The client removed the order from «Мои заказы». History stays for the provider and moderation. */
    clientHiddenAt: ts("client_hidden_at"),
    createdAt: createdAt(),
    assignedAt: ts("assigned_at"),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    index("orders_client_idx").on(t.clientId),
    index("orders_provider_idx").on(t.providerId),
    index("orders_status_idx").on(t.status),
    index("orders_sub_idx").on(t.subcategoryId),
  ],
);

export const orderPhotos = pgTable("order_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: createdAt(),
});

/** Status history / timeline. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const orderResponses = pgTable(
  "order_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    price: integer("price"),
    eta: text("eta"),
    status: responseStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("order_responses_unique").on(t.orderId, t.providerId), index("order_responses_provider_idx").on(t.providerId)],
);

/* ───────────────────────────── messaging ───────────────────────────── */

/** A provider hid an open order from their feed («Не интересно» in the app or in Telegram). */
export const orderDismissals = pgTable(
  "order_dismissals",
  {
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.providerId, t.orderId] })],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    lastMessagePreview: text("last_message_preview").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("conversations_pair").on(t.clientId, t.providerId), index("conversations_last_idx").on(t.lastMessageAt)],
);

export type MessageAttachment = { url: string; width?: number; height?: number; name?: string; mime?: string };

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    kind: messageKind("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    attachments: jsonb("attachments").$type<MessageAttachment[]>(),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)],
);

/* ───────────────────────────── social proof ───────────────────────────── */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    text: text("text").notNull().default(""),
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    reply: text("reply"),
    status: reviewStatus("status").notNull().default("visible"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reviews_order_unique").on(t.orderId), index("reviews_provider_idx").on(t.providerId, t.createdAt)],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.providerId] })],
);

/* ───────────────────────────── notifications ───────────────────────────── */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // order.response | message.new | order.assigned | order.status | reminder | review.new | system
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: ts("read_at"),
    /** channel → delivery status, e.g. { telegram: "sent", email: "skipped" } */
    deliveries: jsonb("deliveries").$type<Record<string, string>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/* ───────────────────────────── monetisation (optional channels) ───────────────────────────── */

/**
 * A provider's request for a paid platform service. There is no acquiring:
 * the provider pays by invoice outside the platform and an admin activates it.
 * Client ↔ provider money never appears in this table.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    amount: integer("amount").notNull(),
    discount: integer("discount").notNull().default(0),
    promoCodeId: integer("promo_code_id"),
    status: invoiceStatus("status").notNull().default("requested"),
    note: text("note"),
    createdAt: createdAt(),
    activatedAt: ts("activated_at"),
    activatedBy: uuid("activated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("invoices_provider_idx").on(t.providerId, t.createdAt), index("invoices_status_idx").on(t.status)],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("active"), // active | expired | cancelled
  /** null = granted by an admin for free (trial, partner, support). */
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  createdAt: createdAt(),
});

export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // boost_24h | boost_7d | highlight_7d
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  createdAt: createdAt(),
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPct: integer("discount_pct").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validUntil: ts("valid_until"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

/**
 * Advertising placements (channel "ads"). Always rendered with the «Реклама» label,
 * the advertiser and the ad-marking token (erid) required by 38-ФЗ.
 */
export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slot: adSlot("slot").notNull(),
    /** Optional targeting: show only in this category (slot "category"). */
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    linkUrl: text("link_url").notNull(),
    advertiser: text("advertiser").notNull(),
    erid: text("erid"),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("ads_slot_idx").on(t.slot, t.isActive)],
);

/* ───────────────────────────── trust & safety ───────────────────────────── */

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // provider | review | order | message | user
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  text: text("text").notNull().default(""),
  status: reportStatus("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedById: uuid("resolved_by_id").references(() => users.id),
  createdAt: createdAt(),
  resolvedAt: ts("resolved_at"),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  answer: text("answer"),
  status: ticketStatus("status").notNull().default("open"),
  createdAt: createdAt(),
  answeredAt: ts("answered_at"),
});

export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_actions_created_idx").on(t.createdAt)],
);

/** Editable marketing content (home banners, FAQ, announcements). */
export const contentBlocks = pgTable("content_blocks", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ───────────────────────────── relations ───────────────────────────── */

export const citiesRelations = relations(cities, ({ many }) => ({ districts: many(districts) }));
export const districtsRelations = relations(districts, ({ one }) => ({ city: one(cities, { fields: [districts.cityId], references: [cities.id] }) }));
export const categoriesRelations = relations(categories, ({ many }) => ({ subcategories: many(subcategories) }));
export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, { fields: [subcategories.categoryId], references: [categories.id] }),
  services: many(services),
}));
export const servicesRelations = relations(services, ({ one }) => ({
  subcategory: one(subcategories, { fields: [services.subcategoryId], references: [subcategories.id] }),
}));
export const usersRelations = relations(users, ({ one }) => ({
  provider: one(providers, { fields: [users.id], references: [providers.userId] }),
  city: one(cities, { fields: [users.cityId], references: [cities.id] }),
}));
export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, { fields: [providers.userId], references: [users.id] }),
  primarySubcategory: one(subcategories, { fields: [providers.primarySubcategoryId], references: [subcategories.id] }),
  city: one(cities, { fields: [providers.cityId], references: [cities.id] }),
  district: one(districts, { fields: [providers.districtId], references: [districts.id] }),
  services: many(providerServices),
  portfolio: many(portfolioItems),
  subcategories: many(providerSubcategories),
  districts: many(providerDistricts),
  reviews: many(reviews),
  documents: many(providerDocuments),
}));
export const providerSubcategoriesRelations = relations(providerSubcategories, ({ one }) => ({
  provider: one(providers, { fields: [providerSubcategories.providerId], references: [providers.id] }),
  subcategory: one(subcategories, { fields: [providerSubcategories.subcategoryId], references: [subcategories.id] }),
}));
export const providerDistrictsRelations = relations(providerDistricts, ({ one }) => ({
  provider: one(providers, { fields: [providerDistricts.providerId], references: [providers.id] }),
  district: one(districts, { fields: [providerDistricts.districtId], references: [districts.id] }),
}));
export const providerServicesRelations = relations(providerServices, ({ one }) => ({
  provider: one(providers, { fields: [providerServices.providerId], references: [providers.id] }),
}));
export const portfolioRelations = relations(portfolioItems, ({ one }) => ({
  provider: one(providers, { fields: [portfolioItems.providerId], references: [providers.id] }),
}));
export const providerDocumentsRelations = relations(providerDocuments, ({ one }) => ({
  provider: one(providers, { fields: [providerDocuments.providerId], references: [providers.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(users, { fields: [orders.clientId], references: [users.id] }),
  provider: one(providers, { fields: [orders.providerId], references: [providers.id] }),
  subcategory: one(subcategories, { fields: [orders.subcategoryId], references: [subcategories.id] }),
  service: one(services, { fields: [orders.serviceId], references: [services.id] }),
  district: one(districts, { fields: [orders.districtId], references: [districts.id] }),
  city: one(cities, { fields: [orders.cityId], references: [cities.id] }),
  photos: many(orderPhotos),
  responses: many(orderResponses),
  events: many(orderEvents),
  review: one(reviews, { fields: [orders.id], references: [reviews.orderId] }),
}));
export const orderPhotosRelations = relations(orderPhotos, ({ one }) => ({ order: one(orders, { fields: [orderPhotos.orderId], references: [orders.id] }) }));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({ order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }) }));
export const orderResponsesRelations = relations(orderResponses, ({ one }) => ({
  order: one(orders, { fields: [orderResponses.orderId], references: [orders.id] }),
  provider: one(providers, { fields: [orderResponses.providerId], references: [providers.id] }),
}));
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  client: one(users, { fields: [conversations.clientId], references: [users.id] }),
  provider: one(providers, { fields: [conversations.providerId], references: [providers.id] }),
  order: one(orders, { fields: [conversations.orderId], references: [orders.id] }),
  messages: many(messages),
}));
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));
export const reviewsRelations = relations(reviews, ({ one }) => ({
  provider: one(providers, { fields: [reviews.providerId], references: [providers.id] }),
  author: one(users, { fields: [reviews.authorId], references: [users.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
}));
export const favoritesRelations = relations(favorites, ({ one }) => ({
  provider: one(providers, { fields: [favorites.providerId], references: [providers.id] }),
}));
export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
}));
export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
}));
export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, { fields: [adminActions.adminId], references: [users.id] }),
}));

/* ───────────────────────────── row types ───────────────────────────── */

export type User = typeof users.$inferSelect;
export type City = typeof cities.$inferSelect;
export type District = typeof districts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type ProviderService = typeof providerServices.$inferSelect;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderResponse = typeof orderResponses.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Ad = typeof ads.$inferSelect;
export type LoginRequest = typeof loginRequests.$inferSelect;
