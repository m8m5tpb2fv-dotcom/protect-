import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "@/server/telegram/init-data";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { decodeStartParam, encodeStartParam, miniAppUrl } from "@/lib/deeplink";
import { km, plural, priceFrom, relative } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { rateLimit, resetRateLimits } from "@/server/http/rate-limit";
import { createOrderSchema, providerProfileSchema } from "@/lib/validation";
import { tokenize } from "@/server/services/providers";
import { maskAddress } from "@/server/services/orders";

const BOT = "123456:TEST-TOKEN";

describe("Telegram initData", () => {
  const user = JSON.stringify({ id: 42, first_name: "Иван", username: "ivan" });
  it("accepts correctly signed data", () => {
    const data = signInitData({ user, auth_date: String(Math.floor(Date.now() / 1000)), start_param: "provider_aleksey-morozov" }, BOT);
    const v = verifyInitData(data, BOT);
    expect(v?.user.id).toBe(42);
    expect(v?.startParam).toBe("provider_aleksey-morozov");
  });
  it("rejects tampered data", () => {
    const data = signInitData({ user, auth_date: String(Math.floor(Date.now() / 1000)) }, BOT);
    const tampered = data.replace("%22id%22%3A42", "%22id%22%3A43");
    expect(tampered).not.toBe(data);
    expect(verifyInitData(tampered, BOT)).toBeNull();
  });
  it("rejects a different bot token", () => {
    const data = signInitData({ user, auth_date: String(Math.floor(Date.now() / 1000)) }, BOT);
    expect(verifyInitData(data, "999:OTHER")).toBeNull();
  });
  it("rejects expired data", () => {
    const data = signInitData({ user, auth_date: String(Math.floor(Date.now() / 1000) - 2 * 86400) }, BOT);
    expect(verifyInitData(data, BOT)).toBeNull();
  });
  it("rejects missing hash / garbage", () => {
    expect(verifyInitData("user=1", BOT)).toBeNull();
    expect(verifyInitData("", BOT)).toBeNull();
  });
});

describe("phone", () => {
  it("normalises Russian numbers", () => {
    expect(normalizePhone("8 (900) 123-45-67")).toBe("+79001234567");
    expect(normalizePhone("+7 900 123 45 67")).toBe("+79001234567");
    expect(normalizePhone("9001234567")).toBe("+79001234567");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+7 800 123 45 67")).toBeNull(); // not mobile
  });
  it("formats", () => expect(formatPhone("+79001234567")).toBe("+7 900 123-45-67"));
});

describe("deep links", () => {
  it("round-trips", () => {
    expect(decodeStartParam(encodeStartParam({ kind: "provider", value: "aleksey-morozov" }))).toBe("/provider/aleksey-morozov");
    expect(decodeStartParam("order_3f1c2a1e-1111-2222-3333-444455556666")).toBe("/orders/3f1c2a1e-1111-2222-3333-444455556666");
    expect(decodeStartParam("service_ustranit-protechku")).toBe("/order/new?service=ustranit-protechku");
  });
  it("rejects unsafe values", () => {
    expect(decodeStartParam("provider_../../admin")).toBeNull();
    expect(decodeStartParam("javascript:alert(1)")).toBeNull();
    expect(() => encodeStartParam({ kind: "provider", value: "a/b" })).toThrow();
  });
  it("builds mini app url", () => {
    expect(miniAppUrl("RyadomBot", "app", { kind: "category", value: "remont" })).toBe("https://t.me/RyadomBot/app?startapp=category_remont");
    expect(miniAppUrl("", "app")).toBeNull();
    // without a registered Mini App the link goes through the bot chat (/start payload → «Открыть» button)
    expect(miniAppUrl("RyadomBot", "", { kind: "provider", value: "ivan-petrov" })).toBe("https://t.me/RyadomBot?start=provider_ivan-petrov");
    expect(miniAppUrl("RyadomBot", "")).toBe("https://t.me/RyadomBot");
  });
});

describe("format", () => {
  it("plurals", () => {
    expect(plural(1, ["отзыв", "отзыва", "отзывов"])).toBe("отзыв");
    expect(plural(3, ["отзыв", "отзыва", "отзывов"])).toBe("отзыва");
    expect(plural(11, ["отзыв", "отзыва", "отзывов"])).toBe("отзывов");
    expect(plural(21, ["отзыв", "отзыва", "отзывов"])).toBe("отзыв");
  });
  it("distances and prices", () => {
    expect(km(2.44)).toBe("2,4 км");
    expect(km(0.3)).toBe("300 м");
    expect(priceFrom(null)).toBe("Цена по договорённости");
  });
  it("relative time", () => expect(relative(new Date(Date.now() - 5 * 60000))).toBe("5 минут назад"));
  it("slugify", () => expect(slugify("Алексей Морозов")).toBe("aleksey-morozov"));
});

describe("passwords", () => {
  it("hash & verify", async () => {
    const h = await hashPassword("correct horse");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
  });
});

describe("rate limit", () => {
  it("blocks after the limit", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000).ok).toBe(true);
    expect(rateLimit("k", 3, 1000).ok).toBe(false);
  });
});

describe("validation", () => {
  it("rejects foreign upload urls (XSS / SSRF vectors)", () => {
    const base = { subcategoryId: 1, title: "Протечка", description: "Капает под раковиной", address: "ул. Московская, 1", urgency: "today" as const };
    expect(createOrderSchema.safeParse({ ...base, photos: ["/files/order/ab/x.webp"] }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, photos: ["https://evil.example/x.png"] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, photos: ["javascript:alert(1)"] }).success).toBe(false);
  });
  it("telegram handle", () => {
    const p = { displayName: "Иван", headline: "Сантехник на все руки", primarySubcategoryId: 1 };
    expect(providerProfileSchema.safeParse({ ...p, telegram: "@ivan_99" }).success).toBe(true);
    expect(providerProfileSchema.safeParse({ ...p, telegram: "<script>" }).success).toBe(false);
  });
});

describe("search tokenizer", () => {
  it("drops stop words", () => expect(tokenize("Нужен электрик срочно в Саратове")).toEqual(["электрик"]));
  it("normalises ё", () => expect(tokenize("Ремонт iPhone, ёлка")).toEqual(["ремонт", "iphone", "елка"]));
});

describe("address masking", () => {
  it("hides the flat before assignment", () => {
    expect(maskAddress("Саратов, ул. Московская, 12, кв. 45")).toBe("Саратов, ул. Московская, 12");
  });
});
