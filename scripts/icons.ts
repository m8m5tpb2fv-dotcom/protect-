/* Generates app icons and Telegram images from the brand mark (src/lib/brand.ts). Run: npx tsx scripts/icons.ts */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { brandSvg } from "../src/lib/brand";

const png = (svg: string, out: string, size: number) => sharp(Buffer.from(svg), { density: 72 * (size / 32) }).resize(size, size).png().toFile(out);

async function main() {
  mkdirSync("public/icons", { recursive: true });
  mkdirSync("public/brand", { recursive: true });
  writeFileSync("public/icon.svg", brandSvg());
  await png(brandSvg({ rx: 9.6 }), "public/icons/icon-192.png", 192);
  await png(brandSvg({ rx: 9.6 }), "public/icons/icon-512.png", 512);
  // maskable: full-bleed background, glyph inside the 80% safe zone
  await png(brandSvg({ rx: 0, scale: 0.78 }), "public/icons/icon-maskable-512.png", 512);
  // iOS rounds the corners itself
  await png(brandSvg({ rx: 0, scale: 0.9 }), "public/icons/apple-touch-icon.png", 180);
  await png(brandSvg({ rx: 7 }), "public/favicon.png", 48);
  // Telegram bot avatar (BotFather /setuserpic): square, Telegram crops it to a circle
  await png(brandSvg({ rx: 0, scale: 0.82 }), "public/brand/bot-avatar-640.png", 640);
  console.log("icons generated");
}
main();
