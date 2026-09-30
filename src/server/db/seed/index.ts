import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as s from "../schema";
import { hashPassword } from "../../auth/password";
import { slugify } from "../../../lib/slug";
import { rebuildSearchText, recomputeProviderStats } from "../../services/provider-stats";
import { CATALOG, CITIES, SARATOV_DISTRICTS } from "./catalog";
import {
  BIO_TEMPLATES, COMPANIES, COMPANY_BIO, FEMALE_FIRST, FEMALE_LEANING, HEADLINE_TEMPLATES, LAST, MALE_FIRST,
  PORTFOLIO_CAPTIONS, RESPONSE_TEXTS, REVIEW_TEXTS_3, REVIEW_TEXTS_4, REVIEW_TEXTS_5, STREETS,
} from "./people";

type DB = NodePgDatabase<typeof s>;

function prng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}
const rand = prng(64);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000);

export const DEMO_PASSWORD = "demo-password";
export const DEMO_CLIENT_EMAIL = "client@demo.ryadom.local";
export const DEMO_PROVIDER_EMAIL = "provider@demo.ryadom.local";

const SCHEDULES: s.WeeklySchedule[] = [
  { mon: { from: "09:00", to: "19:00" }, tue: { from: "09:00", to: "19:00" }, wed: { from: "09:00", to: "19:00" }, thu: { from: "09:00", to: "19:00" }, fri: { from: "09:00", to: "19:00" }, sat: { from: "10:00", to: "16:00" }, sun: null },
  { mon: { from: "08:00", to: "22:00" }, tue: { from: "08:00", to: "22:00" }, wed: { from: "08:00", to: "22:00" }, thu: { from: "08:00", to: "22:00" }, fri: { from: "08:00", to: "22:00" }, sat: { from: "08:00", to: "22:00" }, sun: { from: "10:00", to: "20:00" } },
  { mon: { from: "10:00", to: "20:00" }, tue: null, wed: { from: "10:00", to: "20:00" }, thu: { from: "10:00", to: "20:00" }, fri: { from: "10:00", to: "20:00" }, sat: { from: "10:00", to: "20:00" }, sun: { from: "11:00", to: "18:00" } },
];

export async function seedReference(db: DB) {
  for (const c of CITIES) {
    await db.insert(s.cities).values(c).onConflictDoUpdate({ target: s.cities.slug, set: { name: c.name, nameIn: c.nameIn, isActive: c.isActive, sortOrder: c.sortOrder } });
  }
  const [saratov] = await db.select().from(s.cities).where(eq(s.cities.slug, "saratov"));
  for (const [i, d] of SARATOV_DISTRICTS.entries()) {
    await db
      .insert(s.districts)
      .values({ ...d, cityId: saratov.id, sortOrder: i })
      .onConflictDoUpdate({ target: [s.districts.cityId, s.districts.slug], set: { name: d.name, lat: d.lat, lng: d.lng, sortOrder: i } });
  }
  for (const [ci, c] of CATALOG.entries()) {
    const [cat] = await db
      .insert(s.categories)
      .values({ slug: c.slug, name: c.name, icon: c.icon, emoji: c.emoji, tone: c.tone, description: c.description, sortOrder: ci })
      .onConflictDoUpdate({ target: s.categories.slug, set: { name: c.name, icon: c.icon, emoji: c.emoji, tone: c.tone, description: c.description, sortOrder: ci } })
      .returning();
    for (const [si, sub] of c.subs.entries()) {
      const [subRow] = await db
        .insert(s.subcategories)
        .values({ categoryId: cat.id, slug: sub.slug, name: sub.name, namePlural: sub.plural, icon: sub.icon, keywords: sub.keywords, sortOrder: si })
        .onConflictDoUpdate({ target: s.subcategories.slug, set: { categoryId: cat.id, name: sub.name, namePlural: sub.plural, icon: sub.icon, keywords: sub.keywords, sortOrder: si } })
        .returning();
      for (const [vi, [slug, name, priceFrom, unit, popular, keywords]] of sub.services.entries()) {
        await db
          .insert(s.services)
          .values({ subcategoryId: subRow.id, slug, name, priceFrom, unit, isPopular: !!popular, keywords: keywords ?? "", sortOrder: vi })
          .onConflictDoUpdate({ target: s.services.slug, set: { subcategoryId: subRow.id, name, priceFrom, unit, isPopular: !!popular, keywords: keywords ?? "", sortOrder: vi } });
      }
    }
  }
  await db
    .insert(s.contentBlocks)
    .values([
      { key: "home.urgent", title: "Нужна помощь срочно?", body: "Опишите задачу — исполнители рядом получат уведомление и ответят в течение нескольких минут." },
      { key: "home.announcement", title: "Мы запустились в Саратове", body: "Скоро — Энгельс, Самара, Волгоград и Казань.", isActive: true },
      { key: "faq.how", title: "Как это работает?", body: "Вы описываете задачу, исполнители присылают отклики с ценой и сроками. Вы выбираете подходящего и договариваетесь в чате." },
      { key: "faq.price", title: "Сколько стоит?", body: "Бесплатно для всех. Комиссии нет ни с клиента, ни с исполнителя: за работу вы платите исполнителю напрямую." },
      { key: "faq.verify", title: "Что значит «Проверенный»?", body: "Платформа проверила документы исполнителя. Это статус модерации платформы, а не юридическая гарантия качества работ." },
    ])
    .onConflictDoNothing();
  return { saratov };
}

export async function ensureAdmin(db: DB, email: string, password: string) {
  if (!email || !password) {
    console.warn("! ADMIN_EMAIL / ADMIN_PASSWORD not set — admin user not created");
    return null;
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = ${email.toLowerCase()}`);
  if (existing) {
    await db.update(s.users).set({ role: "admin", passwordHash }).where(eq(s.users.id, existing.id));
    return existing.id;
  }
  const [u] = await db.insert(s.users).values({ name: "Администратор", email: email.toLowerCase(), emailVerifiedAt: new Date(), passwordHash, role: "admin" }).returning();
  return u.id;
}

export async function seedDemo(db: DB) {
  const [existing] = await db.select({ c: sql<number>`count(*)::int` }).from(s.providers);
  if (existing.c > 0) {
    console.log("• demo data already present — skipping (use db:reset to start over)");
    return;
  }
  const [saratov] = await db.select().from(s.cities).where(eq(s.cities.slug, "saratov"));
  const districts = await db.select().from(s.districts).where(eq(s.districts.cityId, saratov.id));
  const subs = await db.select().from(s.subcategories);
  const cats = await db.select().from(s.categories);
  const svcs = await db.select().from(s.services);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const demoHash = await hashPassword(DEMO_PASSWORD);

  /* clients */
  const [demoClient] = await db
    .insert(s.users)
    .values({ name: "Анна Лебедева", email: DEMO_CLIENT_EMAIL, emailVerifiedAt: new Date(), phone: "+79000000001", passwordHash: demoHash, cityId: saratov.id, districtId: districts[1].id, createdAt: daysAgo(200) })
    .returning();
  const clients = [demoClient];
  for (let i = 0; i < 40; i++) {
    const female = rand() < 0.55;
    const [ln] = [pick(LAST)];
    const name = `${female ? pick(FEMALE_FIRST) : pick(MALE_FIRST)} ${female ? ln[1] : ln[0]}`;
    const [u] = await db
      .insert(s.users)
      .values({ name, email: `client${i + 1}@demo.ryadom.local`, passwordHash: demoHash, cityId: saratov.id, districtId: pick(districts).id, createdAt: daysAgo(int(1, 360)) })
      .returning();
    clients.push(u);
  }

  /* providers: 1–4 per subcategory, more in popular ones */
  const HOT = new Set(["santehnik", "elektrik", "master-na-chas", "uborka", "remont-telefonov", "manikyur", "gruzoperevozki", "fotograf", "remont-tehniki"]);
  const usedNames = new Set<string>();
  const created: { id: string; sub: (typeof subs)[number] }[] = [];

  const makeProvider = async (sub: (typeof subs)[number], opts: { demo?: boolean; forceCompany?: boolean } = {}) => {
    const cat = catById.get(sub.categoryId)!;
    const companyPool = COMPANIES[sub.slug];
    const isCompany = !opts.demo && (opts.forceCompany || (companyPool && rand() < 0.45));
    let displayName: string;
    if (opts.demo) displayName = "Алексей Морозов";
    else if (isCompany) displayName = companyPool!.find((n) => !usedNames.has(n)) ?? `${pick(companyPool!)} ${int(2, 9)}`;
    else {
      const female = FEMALE_LEANING.has(sub.slug) ? rand() < 0.85 : rand() < 0.15;
      do {
        const ln = pick(LAST);
        displayName = `${female ? pick(FEMALE_FIRST) : pick(MALE_FIRST)} ${female ? ln[1] : ln[0]}`;
      } while (usedNames.has(displayName) || displayName === "Алексей Морозов");
    }
    usedNames.add(displayName);
    const district = opts.demo ? districts[2] : pick(districts);
    const exp = opts.demo ? 12 : int(2, 18);
    const subSvcs = svcs.filter((v) => v.subcategoryId === sub.id);
    const basePrice = Math.min(...subSvcs.map((v) => v.priceFrom ?? 1000));
    const priceFrom = Math.round((basePrice * (0.85 + rand() * 0.4)) / 50) * 50;
    const headlineTpl = pick(isCompany ? HEADLINE_TEMPLATES.company : HEADLINE_TEMPLATES.default);
    const headline = opts.demo
      ? "Сантехник. Протечки, смесители, засоры — в день обращения"
      : headlineTpl.replace("{sub}", sub.name).replace("{subLower}", sub.name.toLowerCase()).replace("{exp}", String(exp));
    const bio = (isCompany ? pick(COMPANY_BIO) : pick(BIO_TEMPLATES)).replace("{exp}", String(exp)).replace("{team}", String(int(3, 12)));
    const ordersCompleted = opts.demo ? 247 : int(8, 420);
    const verification = opts.demo ? "pro" : isCompany ? (rand() < 0.7 ? "business" : "verified") : pick(["none", "verified", "verified", "verified", "pro"] as const);
    const userEmail = opts.demo ? DEMO_PROVIDER_EMAIL : `${slugify(displayName)}-${int(10, 99)}@demo.ryadom.local`;
    const [user] = await db
      .insert(s.users)
      .values({ name: displayName, email: userEmail, passwordHash: demoHash, phone: opts.demo ? "+79000000002" : null, cityId: saratov.id, districtId: district.id, createdAt: daysAgo(int(200, 700)) })
      .returning();
    let slug = slugify(displayName);
    if (created.some((c) => c.id === slug)) slug = `${slug}-${int(2, 99)}`;
    const [{ c: taken }] = await db.select({ c: sql<number>`count(*)::int` }).from(s.providers).where(eq(s.providers.slug, slug));
    if (taken) slug = `${slug}-${int(10, 999)}`;
    const jitter = () => (rand() - 0.5) * 0.02;
    const [p] = await db
      .insert(s.providers)
      .values({
        userId: user.id,
        slug,
        displayName,
        kind: isCompany ? "company" : "person",
        headline,
        bio,
        primarySubcategoryId: sub.id,
        cityId: saratov.id,
        districtId: district.id,
        lat: district.lat + jitter(),
        lng: district.lng + jitter(),
        radiusKm: pick([5, 8, 10, 15, 20]),
        worksCityWide: rand() < 0.4,
        experienceYears: exp,
        priceFrom,
        phone: `+7 9${int(10, 99)} ${int(100, 999)}-${int(10, 99)}-${int(10, 99)}`,
        telegram: rand() < 0.6 ? `@${slugify(displayName).replace(/-/g, "_").slice(0, 20)}` : null,
        coverUrl: `/art/${cat.tone}/${sub.icon}/${slug}-cover.svg?w=1600&h=900`,
        schedule: pick(SCHEDULES),
        status: "active",
        verification,
        isAvailable: opts.demo ? true : rand() < 0.62,
        ordersCompleted,
        clientsCount: Math.round(ordersCompleted * (0.7 + rand() * 0.2)),
        repeatClientsPct: int(12, 48),
        responseTimeMin: opts.demo ? 7 : pick([3, 5, 7, 10, 12, 15, 20, 30, 45, 60]),
        proUntil: rand() < 0.12 ? daysAgo(-int(5, 25)) : null,
        boostedUntil: rand() < 0.08 ? daysAgo(-int(1, 5)) : null,
        highlightedUntil: rand() < 0.05 ? daysAgo(-int(1, 5)) : null,
        createdAt: daysAgo(int(60, 600)),
        approvedAt: daysAgo(int(30, 59)),
      })
      .returning();
    await db.insert(s.providerSubcategories).values({ providerId: p.id, subcategoryId: sub.id });
    // sometimes a related second speciality
    const siblings = subs.filter((x) => x.categoryId === sub.categoryId && x.id !== sub.id);
    if (siblings.length && rand() < 0.35) await db.insert(s.providerSubcategories).values({ providerId: p.id, subcategoryId: pick(siblings).id }).onConflictDoNothing();
    await db.insert(s.providerDistricts).values({ providerId: p.id, districtId: district.id });

    for (const [i, v] of subSvcs.entries()) {
      const k = 0.85 + rand() * 0.45;
      const from = Math.round(((v.priceFrom ?? 1000) * k) / 50) * 50;
      await db.insert(s.providerServices).values({ providerId: p.id, serviceId: v.id, title: v.name, priceFrom: from, priceTo: rand() < 0.4 ? Math.round((from * 2.2) / 100) * 100 : null, unit: v.unit ?? "за услугу", sortOrder: i });
    }

    const ratios: [number, number][] = [[1200, 1500], [1200, 900], [1200, 1200], [1200, 1600], [1600, 1000]];
    const nPortfolio = opts.demo ? 9 : int(3, 8);
    for (let i = 0; i < nPortfolio; i++) {
      const [w, h] = pick(ratios);
      const caption = pick(PORTFOLIO_CAPTIONS).replace("{street}", pick(STREETS)).replace("{district}", district.name.replace(/ий$/, "ом").replace(/ой$/, "ом"));
      await db.insert(s.portfolioItems).values({ providerId: p.id, url: `/art/${cat.tone}/${sub.icon}/${slug}-${i}.svg?w=${w}&h=${h}`, width: w, height: h, caption, sortOrder: i });
    }

    // historical reviews (not tied to orders on the platform)
    const nReviews = opts.demo ? 14 : int(2, 11);
    for (let i = 0; i < nReviews; i++) {
      const roll = rand();
      const rating = roll < 0.78 ? 5 : roll < 0.95 ? 4 : 3;
      const text = rating === 5 ? pick(REVIEW_TEXTS_5) : rating === 4 ? pick(REVIEW_TEXTS_4) : pick(REVIEW_TEXTS_3);
      const author = pick(clients.slice(1));
      await db.insert(s.reviews).values({
        providerId: p.id,
        authorId: author.id,
        rating,
        text,
        reply: rand() < 0.25 ? "Спасибо за отзыв! Обращайтесь." : null,
        photos: rand() < 0.2 ? [`/art/${cat.tone}/${sub.icon}/${slug}-r${i}.svg?w=800&h=800`] : [],
        createdAt: daysAgo(int(2, 360), int(0, 23)),
      });
    }
    await rebuildSearchText(db, p.id);
    await recomputeProviderStats(db, p.id);
    created.push({ id: p.id, sub });
    return { provider: p, user };
  };

  const santehnik = subs.find((x) => x.slug === "santehnik")!;
  const { provider: demoProvider, user: demoProviderUser } = await makeProvider(santehnik, { demo: true });

  for (const sub of subs) {
    const n = HOT.has(sub.slug) ? int(3, 4) : int(1, 2);
    for (let i = 0; i < n; i++) await makeProvider(sub, { forceCompany: i === 0 && !!COMPANIES[sub.slug] && rand() < 0.5 });
  }

  // a couple of providers waiting for moderation
  for (const slug of ["elektrik", "fotograf", "repetitor-matematika"]) {
    const sub = subs.find((x) => x.slug === slug)!;
    const { provider } = await makeProvider(sub);
    await db.update(s.providers).set({ status: "pending", verification: "none", approvedAt: null, ordersCompleted: 0, createdAt: daysAgo(int(0, 3)) }).where(eq(s.providers.id, provider.id));
  }

  /* orders */
  const elektrik = subs.find((x) => x.slug === "elektrik")!;
  const uborka = subs.find((x) => x.slug === "uborka")!;
  const manikyur = subs.find((x) => x.slug === "manikyur")!;
  const provOf = async (subId: number, exclude: string[] = []) => {
    const rows = await db.select().from(s.providers).where(and(eq(s.providers.primarySubcategoryId, subId), eq(s.providers.status, "active")));
    return rows.filter((r) => !exclude.includes(r.id));
  };
  const svcOf = (subId: number) => svcs.find((v) => v.subcategoryId === subId);

  const mkOrder = async (o: Partial<typeof s.orders.$inferInsert> & { clientId: string; subcategoryId: number; title: string; description: string }) => {
    const d = pick(districts);
    const [row] = await db
      .insert(s.orders)
      .values({
        cityId: saratov.id,
        districtId: d.id,
        address: `Саратов, ул. ${pick(STREETS)}, ${int(1, 120)}`,
        lat: d.lat + (rand() - 0.5) * 0.01,
        lng: d.lng + (rand() - 0.5) * 0.01,
        serviceId: svcOf(o.subcategoryId)?.id,
        ...o,
      })
      .returning();
    await db.insert(s.orderEvents).values({ orderId: row.id, actorId: o.clientId, type: "created", createdAt: row.createdAt });
    return row;
  };

  // 1. Demo client: open order with responses (the "leak under the sink" scenario)
  const leak = await mkOrder({
    clientId: demoClient.id,
    subcategoryId: santehnik.id,
    serviceId: svcs.find((v) => v.slug === "ustranit-protechku")!.id,
    title: "Устранить протечку",
    description: "Протекает труба под раковиной на кухне, капает с соединения. Перекрыла воду.",
    urgency: "today",
    budget: 1500,
    status: "responses",
    createdAt: daysAgo(0, 2),
  });
  const leakResponders = (await provOf(santehnik.id, [demoProvider.id])).slice(0, 3);
  for (const [i, p] of leakResponders.entries()) {
    await db.insert(s.orderResponses).values({ orderId: leak.id, providerId: p.id, message: RESPONSE_TEXTS[i % RESPONSE_TEXTS.length], price: 1000 + i * 300, eta: ["Сегодня 17:00", "Сегодня 19:30", "Завтра 10:00"][i], createdAt: daysAgo(0, 1.8 - i * 0.4) });
  }

  // 2. Demo client: in-progress order with an electrician
  const [elProvider] = await provOf(elektrik.id);
  const inProgress = await mkOrder({
    clientId: demoClient.id, subcategoryId: elektrik.id, title: "Повесить люстру", description: "Нужно снять старую люстру и повесить новую, потолок 2.7 м. Люстра уже куплена.",
    urgency: "week", status: "in_progress", providerId: elProvider.id, agreedPrice: 1200, createdAt: daysAgo(2), assignedAt: daysAgo(2, -2), startedAt: daysAgo(0, 5),
  });
  await db.insert(s.orderResponses).values({ orderId: inProgress.id, providerId: elProvider.id, message: "Здравствуйте! Могу в четверг после обеда.", price: 1200, eta: "Четверг", status: "accepted", createdAt: daysAgo(2, -1) });
  await db.insert(s.orderEvents).values([
    { orderId: inProgress.id, actorId: demoClient.id, type: "assigned", data: { providerId: elProvider.id }, createdAt: daysAgo(2, -2) },
    { orderId: inProgress.id, actorId: elProvider.userId, type: "started", createdAt: daysAgo(0, 5) },
  ]);

  // 3. Demo client: completed order awaiting review
  const [cleaner] = await provOf(uborka.id);
  const done = await mkOrder({
    clientId: demoClient.id, subcategoryId: uborka.id, title: "Генеральная уборка", description: "Двухкомнатная квартира 54 м², нужно помыть окна и кухню.",
    urgency: "week", status: "completed", providerId: cleaner.id, agreedPrice: 5500, createdAt: daysAgo(9), assignedAt: daysAgo(9, -3), startedAt: daysAgo(7), completedAt: daysAgo(7, -4),
  });
  await db.insert(s.orderEvents).values([
    { orderId: done.id, actorId: demoClient.id, type: "assigned", createdAt: daysAgo(9, -3) },
    { orderId: done.id, actorId: cleaner.userId, type: "started", createdAt: daysAgo(7) },
    { orderId: done.id, actorId: cleaner.userId, type: "completed", createdAt: daysAgo(7, -4) },
  ]);

  // 4. Demo client: completed + reviewed
  const [nails] = await provOf(manikyur.id);
  const reviewed = await mkOrder({
    clientId: demoClient.id, subcategoryId: manikyur.id, title: "Маникюр с покрытием", description: "Классический маникюр и однотонное покрытие.",
    urgency: "week", status: "completed", providerId: nails.id, agreedPrice: 1600, createdAt: daysAgo(30), assignedAt: daysAgo(30), completedAt: daysAgo(27),
  });
  await db.insert(s.reviews).values({ orderId: reviewed.id, providerId: nails.id, authorId: demoClient.id, rating: 5, text: "Очень аккуратно и красиво, держится уже три недели. Запишусь ещё!", createdAt: daysAgo(26) });
  await db.insert(s.orderEvents).values({ orderId: reviewed.id, actorId: nails.userId, type: "completed", createdAt: daysAgo(27) });

  // 5. Cancelled
  await mkOrder({ clientId: demoClient.id, subcategoryId: santehnik.id, title: "Установить смеситель", description: "Сломался смеситель в ванной.", urgency: "week", status: "cancelled", cancelReason: "Починили сами", createdAt: daysAgo(45), cancelledAt: daysAgo(44) });

  // Open orders for providers to respond to (including the demo plumber)
  const openTitles: [string, string, s.Order["urgency"]][] = [
    ["Засор в ванной", "Вода плохо уходит из ванны, пробовали средство — не помогло.", "urgent"],
    ["Заменить смеситель на кухне", "Смеситель куплен, нужно снять старый и установить новый.", "week"],
    ["Течёт бачок унитаза", "Постоянно подтекает вода в унитаз, шумит.", "today"],
    ["Разводка труб в ванной", "Ремонт в ванной, нужна новая разводка под душевую и раковину.", "flexible"],
  ];
  for (const [i, [title, description, urg]] of openTitles.entries()) {
    const o = await mkOrder({ clientId: clients[2 + i].id, subcategoryId: santehnik.id, title, description, urgency: urg, budget: pick([null, 1500, 2000, 3000]), status: "new", createdAt: daysAgo(0, 1 + i * 5) });
    if (i === 1) {
      await db.insert(s.orderResponses).values({ orderId: o.id, providerId: leakResponders[0].id, message: RESPONSE_TEXTS[1], price: 1100, createdAt: daysAgo(0, 4) });
      await db.update(s.orders).set({ status: "responses" }).where(eq(s.orders.id, o.id));
    }
  }
  // Demo provider: direct order in progress + completed history with platform orders
  const direct = await mkOrder({
    clientId: clients[6].id, subcategoryId: santehnik.id, title: "Поменять сифон под раковиной", description: "Старый сифон треснул. Нужна замена.",
    urgency: "today", status: "assigned", directProviderId: demoProvider.id, providerId: demoProvider.id, agreedPrice: 900, createdAt: daysAgo(0, 6), assignedAt: daysAgo(0, 5),
  });
  await db.insert(s.orderResponses).values({ orderId: direct.id, providerId: demoProvider.id, message: "Приеду сегодня к 18:00.", price: 900, status: "accepted", createdAt: daysAgo(0, 5.5) });
  for (let i = 0; i < 6; i++) {
    const client = clients[8 + i];
    const price = pick([900, 1200, 1500, 2500, 3400]);
    const o = await mkOrder({
      clientId: client.id, subcategoryId: santehnik.id, title: pick(["Устранить протечку", "Прочистить засор", "Установить смеситель", "Установить унитаз"]), description: "Заказ выполнен.",
      status: "completed", providerId: demoProvider.id, agreedPrice: price, createdAt: daysAgo(10 + i * 9), assignedAt: daysAgo(10 + i * 9), completedAt: daysAgo(9 + i * 9),
    });
    await db.insert(s.orderResponses).values({ orderId: o.id, providerId: demoProvider.id, message: "Готов приехать.", price, status: "accepted", createdAt: new Date(o.createdAt.getTime() + int(3, 12) * 60000) });
    if (i < 4) await db.insert(s.reviews).values({ orderId: o.id, providerId: demoProvider.id, authorId: client.id, rating: i === 2 ? 4 : 5, text: i === 2 ? REVIEW_TEXTS_4[0] : REVIEW_TEXTS_5[i], createdAt: daysAgo(8 + i * 9) });
  }

  // Background marketplace activity for analytics (completed orders across categories)
  const actives = await db.select().from(s.providers).where(eq(s.providers.status, "active"));
  for (let i = 0; i < 90; i++) {
    const p = pick(actives);
    const price = Math.round((p.priceFrom ?? 1000) * (1 + rand() * 2.5) / 50) * 50;
    const age = int(1, 120);
    const status = rand() < 0.78 ? "completed" : rand() < 0.5 ? "cancelled" : "in_progress";
    await mkOrder({
      clientId: pick(clients.slice(1)).id, subcategoryId: p.primarySubcategoryId, title: svcOf(p.primarySubcategoryId)?.name ?? "Заказ", description: "Заказ через платформу.",
      status, providerId: status === "cancelled" ? null : p.id, agreedPrice: status === "cancelled" ? null : price,
      createdAt: daysAgo(age), assignedAt: status === "cancelled" ? null : daysAgo(age, -1), completedAt: status === "completed" ? daysAgo(Math.max(0, age - 1)) : null, cancelledAt: status === "cancelled" ? daysAgo(age, -3) : null,
    });
  }

  for (const c of created) await recomputeProviderStats(db, c.id);
  await recomputeProviderStats(db, demoProvider.id);
  await db.update(s.providers).set({ responseTimeMin: 7 }).where(eq(s.providers.id, demoProvider.id));

  /* conversations */
  const conv = async (clientId: string, providerRow: typeof demoProvider, orderId: string | null, msgs: [from: "c" | "p", body: string, hoursAgo: number, read?: boolean][]) => {
    const last = msgs[msgs.length - 1];
    const [c] = await db
      .insert(s.conversations)
      .values({ clientId, providerId: providerRow.id, orderId, lastMessageAt: daysAgo(0, last[2]), lastMessagePreview: last[1].slice(0, 120) })
      .returning();
    for (const [from, body, h, read] of msgs) {
      await db.insert(s.messages).values({ conversationId: c.id, senderId: from === "c" ? clientId : providerRow.userId, body, createdAt: daysAgo(0, h), readAt: read === false ? null : daysAgo(0, h - 0.1) });
    }
  };
  await conv(demoClient.id, leakResponders[0], leak.id, [
    ["p", "Здравствуйте! Видел вашу заявку. Можете прислать фото соединения?", 1.7],
    ["c", "Добрый день! Да, сейчас пришлю.", 1.6],
    ["p", "Судя по описанию, нужно заменить прокладку или гайку. Возьму с собой.", 1.2, false],
  ]);
  await conv(demoClient.id, elProvider, inProgress.id, [
    ["c", "Здравствуйте! Люстра тяжёлая, около 8 кг. Это не проблема?", 30],
    ["p", "Здравствуйте, нет, поставлю крюк с анкером. Буду в четверг в 15:00.", 29],
    ["c", "Отлично, жду!", 28.5],
    ["p", "Выезжаю, буду через 20 минут.", 5.2, false],
  ]);
  await conv(clients[6].id, demoProvider, direct.id, [
    ["c", "Алексей, добрый день! Сифон пластиковый, треснул корпус.", 5.8],
    ["p", "Понял, привезу новый. Буду к 18:00.", 5.4],
    ["c", "Спасибо!", 5.3, false],
  ]);

  /* notifications */
  await db.insert(s.notifications).values([
    { userId: demoClient.id, type: "order.response", title: "3 отклика на заявку", body: "«Устранить протечку» — исполнители готовы приехать сегодня.", link: `/orders/${leak.id}`, createdAt: daysAgo(0, 1.2) },
    { userId: demoClient.id, type: "message.new", title: "Новое сообщение", body: "Выезжаю, буду через 20 минут.", link: `/messages`, createdAt: daysAgo(0, 5.2) },
    { userId: demoClient.id, type: "order.status", title: "Заказ выполнен", body: "Оцените работу исполнителя — это помогает другим.", link: `/orders/${done.id}`, createdAt: daysAgo(7, -4), readAt: daysAgo(6) },
    { userId: demoClient.id, type: "system", title: "Добро пожаловать в «Рядом»", body: "Опишите задачу — и исполнители сами предложат цену.", createdAt: daysAgo(200), readAt: daysAgo(199) },
    { userId: demoProviderUser.id, type: "order.new", title: "Новая заявка рядом", body: "«Засор в ванной» — срочно, 2 км от вас.", link: `/pro`, createdAt: daysAgo(0, 1) },
    { userId: demoProviderUser.id, type: "order.assigned", title: "Вас выбрали исполнителем", body: "«Поменять сифон под раковиной»", link: `/orders/${direct.id}`, createdAt: daysAgo(0, 5) },
  ]);

  /* optional monetisation history: paid by invoice outside the platform, activated by an admin */
  const [admin] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "admin")).limit(1);
  const pros = actives.filter((p) => p.proUntil && p.proUntil.getTime() > Date.now());
  for (const p of pros) {
    const at = daysAgo(int(1, 25));
    const [inv] = await db
      .insert(s.invoices)
      .values({ userId: p.userId, providerId: p.id, productId: "pro_month", amount: 990, status: "activated", createdAt: at, activatedAt: at, activatedBy: admin?.id ?? null })
      .returning();
    await db.insert(s.subscriptions).values({ providerId: p.id, plan: "pro_month", invoiceId: inv.id, startsAt: at, endsAt: p.proUntil! });
  }
  const promoPrices = { boost_24h: 149, boost_7d: 690, highlight_7d: 390 } as const;
  for (const p of actives.filter((x) => x.boostedUntil || x.highlightedUntil)) {
    const productId = p.highlightedUntil ? "highlight_7d" : pick(["boost_24h", "boost_7d"] as const);
    const at = daysAgo(int(0, 3));
    const [inv] = await db
      .insert(s.invoices)
      .values({ userId: p.userId, providerId: p.id, productId, amount: promoPrices[productId], status: "activated", createdAt: at, activatedAt: at, activatedBy: admin?.id ?? null })
      .returning();
    await db.insert(s.promotions).values({ providerId: p.id, kind: productId, invoiceId: inv.id, startsAt: at, endsAt: (p.highlightedUntil ?? p.boostedUntil)! });
  }
  for (const [i, p] of actives.filter((x) => !x.proUntil).slice(0, 4).entries()) {
    const productId = (["pro_month", "boost_7d", "highlight_7d", "boost_24h"] as const)[i];
    const amount = productId === "pro_month" ? 990 : promoPrices[productId];
    await db.insert(s.invoices).values({ userId: p.userId, providerId: p.id, productId, amount, status: i === 3 ? "cancelled" : "requested", note: i === 3 ? "Передумал" : null, createdAt: daysAgo(i) });
  }
  /* sample ad campaigns — fictional advertiser, shown only when the "ads" channel is on */
  await db.insert(s.ads).values([
    { slot: "home", title: "Скидка 15% на стройматериалы", body: "Доставка по Саратову в день заказа. Пример рекламного объявления.", linkUrl: "https://example.com/stroy", advertiser: "ООО «Пример Стройторг» (демо)", erid: "DEMO2Vtzq1", startsAt: daysAgo(10), endsAt: daysAgo(-30), impressions: 1840, clicks: 37 },
    { slot: "search", title: "Химчистка мебели на дому", body: "Пример рекламы в поиске.", linkUrl: "https://example.com/clean", advertiser: "ИП Пример (демо)", erid: "DEMO2Vtzq2", startsAt: daysAgo(5), endsAt: daysAgo(-20), impressions: 920, clicks: 21 },
  ]);
  await db.insert(s.promoCodes).values([
    { code: "WELCOME10", discountPct: 10, maxUses: 500 },
    { code: "PRO50", discountPct: 50, maxUses: 100, validUntil: daysAgo(-60) },
  ]).onConflictDoNothing();

  /* trust & safety */
  const someReview = (await db.select().from(s.reviews).limit(1))[0];
  await db.insert(s.reports).values([
    { reporterId: clients[3].id, targetType: "provider", targetId: actives[5].id, reason: "Не пришёл в назначенное время", text: "Договорились на 10:00, мастер не пришёл и не отвечает." },
    { reporterId: actives[2].userId, targetType: "review", targetId: someReview.id, reason: "Оскорбительный отзыв", text: "" },
  ]);
  await db.insert(s.supportTickets).values([
    { userId: clients[4].id, subject: "Как изменить номер телефона?", body: "Сменил номер, хочу обновить в профиле." },
    { userId: actives[7].userId, subject: "Не приходят уведомления в Telegram", body: "Подключил бота, но уведомления не приходят.", status: "answered", answer: "Нажмите /start в боте — после этого уведомления начнут приходить.", answeredAt: daysAgo(1) },
  ]);

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.providers);
  console.log(`✓ demo data: ${n} providers, ${clients.length} clients`);
}
