/**
 * Captures the key UI states on phone / desktop / tablet, light & dark, plus a
 * simulated Telegram Mini App session (signed initData + stubbed WebApp SDK).
 *   BASE_URL=http://localhost:3000 npx tsx scripts/screenshots.ts
 * Requires demo data and TELEGRAM_BOT_TOKEN in .env (any value works locally).
 */
import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { signInitData } from "../src/server/telegram/init-data";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "screenshots";
const EXEC = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const VIEW = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 }, tablet: { width: 834, height: 1112 } } as const;
type Dev = keyof typeof VIEW;

async function ctx(browser: Browser, dev: Dev, dark = false) {
  const c = await browser.newContext({ viewport: VIEW[dev], deviceScaleFactor: 2, isMobile: dev === "phone", hasTouch: dev !== "desktop", colorScheme: dark ? "dark" : "light", locale: "ru-RU" });
  await c.addCookies([{ name: "ryadom_onboarded", value: "1", url: BASE }]);
  return c;
}

async function login(c: BrowserContext, as: "client" | "provider" | "admin") {
  const page = await c.newPage();
  await page.goto(BASE + "/login");
  if (as === "admin") {
    await page.getByRole("tab", { name: "Email" }).click();
    await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL!);
    await page.getByLabel("Пароль").fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
  } else {
    await page.getByRole("button", { name: as === "client" ? "Клиент" : "Исполнитель" }).click();
  }
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  await page.close();
}

async function shot(page: Page, name: string, path: string, opts: { full?: boolean; before?: (p: Page) => Promise<void> } = {}) {
  await page.goto(BASE + path, { waitUntil: "load" });
  if (opts.before) await opts.before(page);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full ?? false });
  console.log("✓", name);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXEC });
  const errors: string[] = [];
  const track = (p: Page) => p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));

  // ── anonymous
  for (const dev of ["phone", "desktop", "tablet"] as Dev[]) {
    const c = await ctx(browser, dev);
    const p = await c.newPage();
    track(p);
    await shot(p, `${dev}-01-home`, "/");
    if (dev === "phone") await shot(p, `${dev}-01b-home-full`, "/", { full: true });
    await shot(p, `${dev}-02-category`, "/services/santehnik");
    await shot(p, `${dev}-03-provider`, "/provider/aleksey-morozov");
    if (dev !== "tablet") {
      await shot(p, `${dev}-04-search`, "/search?q=нужен%20электрик");
      await shot(p, `${dev}-05-services`, "/services");
      await shot(p, `${dev}-06-login`, "/login");
      await shot(p, `${dev}-07-no-results`, "/search?q=космонавт");
      await shot(p, `${dev}-08-404`, "/provider/nobody-here");
    }
    await c.close();
  }
  // onboarding
  {
    const c = await browser.newContext({ viewport: VIEW.phone, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU" });
    const p = await c.newPage();
    await shot(p, "phone-00-onboarding", "/");
    await c.close();
  }
  // dark
  for (const dev of ["phone", "desktop"] as Dev[]) {
    const c = await ctx(browser, dev, true);
    await c.addCookies([{ name: "ryadom_theme", value: "dark", url: BASE }]);
    const p = await c.newPage();
    await shot(p, `${dev}-dark-01-home`, "/");
    await shot(p, `${dev}-dark-02-provider`, "/provider/aleksey-morozov");
    await c.close();
  }

  // ── client
  for (const dev of ["phone", "desktop"] as Dev[]) {
    const c = await ctx(browser, dev);
    await login(c, "client");
    const p = await c.newPage();
    track(p);
    await shot(p, `${dev}-10-client-orders`, "/orders");
    const orderHref = await p.locator('a[href^="/orders/"]').first().getAttribute("href");
    if (orderHref) await shot(p, `${dev}-11-client-order-responses`, orderHref, { full: dev === "phone" });
    await shot(p, `${dev}-12-order-wizard`, "/order/new?service=ustranit-protechku");
    await shot(p, `${dev}-13-order-wizard-when`, "/order/new?service=ustranit-protechku", {
      before: async (pg) => {
        await pg.getByPlaceholder(/протекает труба/).fill("Капает с соединения под раковиной, воду перекрыли.");
        await pg.getByRole("button", { name: "Далее" }).click();
        await pg.getByLabel(/Адрес/).fill("ул. Московская, 12");
        await pg.getByRole("button", { name: "Далее" }).click();
      },
    });
    await shot(p, `${dev}-14-messages`, "/messages");
    const convHref = await p.locator('a[href^="/messages/"]').first().getAttribute("href");
    if (convHref) await shot(p, `${dev}-15-chat`, convHref);
    await shot(p, `${dev}-16-notifications`, "/notifications");
    await shot(p, `${dev}-17-profile`, "/profile");
    await c.close();
  }

  // ── provider
  for (const dev of ["phone", "desktop"] as Dev[]) {
    const c = await ctx(browser, dev);
    await login(c, "provider");
    const p = await c.newPage();
    track(p);
    await shot(p, `${dev}-20-pro-dashboard`, "/pro", { full: dev === "phone" });
    await shot(p, `${dev}-21-pro-billing`, "/pro/billing");
    await shot(p, `${dev}-22-pro-profile`, "/pro/profile");
    await shot(p, `${dev}-23-pro-portfolio`, "/pro/portfolio");
    await c.close();
  }
  // become provider (fresh email account)
  {
    const c = await ctx(browser, "phone");
    const p = await c.newPage();
    await p.goto(BASE + "/login");
    await p.getByRole("tab", { name: "Email" }).click();
    await p.getByRole("button", { name: /Зарегистрироваться/ }).click();
    await p.getByLabel("Имя").fill("Новый Мастер");
    await p.getByLabel("Email").fill(`new-${Date.now()}@example.com`);
    await p.getByLabel("Пароль").fill("password-12345");
    await p.getByRole("button", { name: "Создать аккаунт" }).click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    await shot(p, "phone-24-become-provider", "/become-provider");
    await c.close();
  }

  // ── admin
  {
    const c = await ctx(browser, "desktop");
    await login(c, "admin");
    const p = await c.newPage();
    track(p);
    await shot(p, "desktop-30-admin-overview", "/admin", { full: true });
    await shot(p, "desktop-31-admin-moderation", "/admin/providers?status=pending");
    await shot(p, "desktop-32-admin-orders", "/admin/orders");
    await shot(p, "desktop-33-admin-payments", "/admin/payments");
    await c.close();
  }

  // ── Telegram Mini App simulation
  {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const initData = signInitData({ user: JSON.stringify({ id: 900001, first_name: "Мария", last_name: "Телеграмова", username: "maria_tg", allows_write_to_pm: true }), auth_date: String(Math.floor(Date.now() / 1000)), start_param: "category_remont" }, token);
      const c = await browser.newContext({ viewport: VIEW.phone, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU" });
      await c.addCookies([{ name: "ryadom_onboarded", value: "1", url: BASE }]);
      await c.route("https://telegram.org/**", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stubbed */" }));
      await c.addInitScript({ content: `window.__TG_INIT__=${JSON.stringify(initData)};\n` + readFileSync("scripts/telegram-stub.js", "utf8") });
      const p = await c.newPage();
      track(p);
      await p.goto(`${BASE}/#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0`, { waitUntil: "load" });
      await p.waitForURL((u) => u.pathname.startsWith("/services/remont"), { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${OUT}/telegram-01-deeplink-category.png` });
      console.log("✓ telegram-01-deeplink-category");
      await p.goto(`${BASE}/`, { waitUntil: "load" });
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${OUT}/telegram-02-home-authed.png` });
      console.log("✓ telegram-02-home-authed");
      await p.goto(`${BASE}/order/new?service=ustranit-protechku`, { waitUntil: "load" });
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${OUT}/telegram-03-order-mainbutton.png` });
      console.log("✓ telegram-03-order-mainbutton");
      await c.close();
    }
  }

  await browser.close();
  if (errors.length) {
    console.error("\nPage errors:\n" + errors.join("\n"));
    process.exitCode = 1;
  }
}
main();
