/* Quick screenshot helper: tsx scripts/shot.ts <path> <out.png> [mobile|desktop|tablet] [dark] [cookie=value;...] */
import { chromium } from "playwright-core";

const [path = "/", out = "screenshots/tmp/shot.png", device = "mobile", theme = "light", cookieStr = ""] = process.argv.slice(2);
const base = process.env.BASE_URL || "http://localhost:3000";
const vp = device === "desktop" ? { width: 1440, height: 900 } : device === "tablet" ? { width: 834, height: 1112 } : { width: 390, height: 844 };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: theme === "dark" ? "dark" : "light", isMobile: device === "mobile", hasTouch: device !== "desktop", locale: "ru-RU" });
  const cookies = [{ name: "ryadom_onboarded", value: "1", url: base }, ...cookieStr.split(";").filter(Boolean).map((c) => ({ name: c.split("=")[0], value: c.split("=").slice(1).join("="), url: base }))];
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("CONSOLE", m.text()));
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: process.env.FULL !== "0" });
  await browser.close();
  console.log("saved", out);
})();
