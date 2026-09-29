import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { cities, otpCodes, users } from "../db/schema";
import { env } from "../env";
import { AppError, badRequest, conflict, tooMany, unauthorized } from "../http/errors";
import { rateLimit } from "../http/rate-limit";
import { sendSms } from "../notifications/channels";
import { verifyInitData } from "../telegram/init-data";
import { normalizePhone } from "@/lib/phone";
import { APP } from "@/config/app";
import { hashPassword, verifyPassword } from "./password";

async function defaultCityId() {
  const [c] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, APP.defaultCitySlug));
  return c?.id ?? null;
}

export async function registerWithEmail(input: { name: string; email: string; password: string }) {
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email.toLowerCase()}`);
  if (existing) throw conflict("Аккаунт с таким email уже существует. Войдите.");
  const [u] = await db
    .insert(users)
    .values({ name: input.name, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password), cityId: await defaultCityId() })
    .returning();
  return u;
}

export async function loginWithEmail(input: { email: string; password: string }, ip: string) {
  const rl = rateLimit(`login:${input.email}`, 8, 15 * 60_000);
  const rlIp = rateLimit(`login-ip:${ip}`, 30, 15 * 60_000);
  if (!rl.ok || !rlIp.ok) throw tooMany("Слишком много попыток входа. Подождите 15 минут.");
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${input.email.toLowerCase()}`);
  const ok = await verifyPassword(input.password, u?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86));
  if (!u || !ok) throw unauthorized("Неверный email или пароль");
  if (u.isBlocked) throw new AppError(403, "blocked", "Аккаунт заблокирован. Напишите в поддержку.");
  return u;
}

function otpHash(target: string, code: string) {
  return createHmac("sha256", env.SESSION_SECRET || "dev-insecure-secret").update(`${target}:${code}`).digest("hex");
}

/** Sends a 6-digit code. In demo/console mode the code is returned so the UI can display it. */
export async function requestPhoneCode(rawPhone: string, ip: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw badRequest("Проверьте номер телефона");
  if (!rateLimit(`otp:${phone}`, 3, 10 * 60_000).ok || !rateLimit(`otp-ip:${ip}`, 10, 60 * 60_000).ok) throw tooMany("Код уже отправлен. Повторить можно через несколько минут.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(otpCodes).values({ target: phone, codeHash: otpHash(phone, code), expiresAt: new Date(Date.now() + 5 * 60_000) });
  const result = await sendSms(phone, `${APP.name}: код входа ${code}. Никому его не сообщайте.`);
  return { phone, devCode: result === "logged" && env.DEMO_MODE ? code : undefined };
}

export async function verifyPhoneCode(input: { phone: string; code: string; name?: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw badRequest("Проверьте номер телефона");
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.target, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw badRequest("Код устарел. Запросите новый.");
  if (otp.attempts >= 5) throw tooMany("Слишком много попыток. Запросите новый код.");
  const a = Buffer.from(otp.codeHash, "hex");
  const b = Buffer.from(otpHash(phone, input.code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw badRequest("Неверный код");
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
  const [existing] = await db.select().from(users).where(eq(users.phone, phone));
  if (existing) {
    if (existing.isBlocked) throw new AppError(403, "blocked", "Аккаунт заблокирован");
    if (!existing.phoneVerifiedAt) await db.update(users).set({ phoneVerifiedAt: new Date() }).where(eq(users.id, existing.id));
    return { user: existing, isNew: false };
  }
  const [u] = await db
    .insert(users)
    .values({ name: input.name || "Пользователь", phone, phoneVerifiedAt: new Date(), cityId: await defaultCityId() })
    .returning();
  return { user: u, isNew: true };
}

/** Telegram Mini App auth: the signature proves the user; we never trust initDataUnsafe. */
export async function loginWithTelegram(initData: string) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new AppError(503, "telegram_disabled", "Вход через Telegram не настроен");
  const data = verifyInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!data) throw unauthorized("Не удалось проверить данные Telegram");
  const tgId = String(data.user.id);
  const name = [data.user.first_name, data.user.last_name].filter(Boolean).join(" ").slice(0, 60) || "Пользователь Telegram";
  const [existing] = await db.select().from(users).where(eq(users.telegramId, tgId));
  if (existing) {
    if (existing.isBlocked) throw new AppError(403, "blocked", "Аккаунт заблокирован");
    await db
      .update(users)
      .set({ telegramUsername: data.user.username ?? null, telegramChatAllowed: existing.telegramChatAllowed || !!data.user.allows_write_to_pm })
      .where(eq(users.id, existing.id));
    return { user: existing, startParam: data.startParam, isNew: false };
  }
  const [u] = await db
    .insert(users)
    .values({
      name,
      telegramId: tgId,
      telegramUsername: data.user.username ?? null,
      telegramChatAllowed: !!data.user.allows_write_to_pm,
      avatarUrl: null, // Telegram photo URLs are short-lived; user can upload their own
      cityId: await defaultCityId(),
    })
    .returning();
  return { user: u, startParam: data.startParam, isNew: true };
}
