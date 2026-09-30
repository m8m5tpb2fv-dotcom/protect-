/* Generates app icons and Telegram images from the brand mark (src/lib/brand.ts). Run: npx tsx scripts/icons.ts */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { brandSvg } from "../src/lib/brand";

const png = (svg: string, out: string, size: number) => sharp(Buffer.from(svg), { density: 72 * (size / 32) }).resize(size, size).png().toFile(out);

async function main() {
  mkdirSync("public/icons", { recursive: true });
  mkdirSync("public/brand", { recursive: true });
  writeFileSync("public/icon.svg", brandSvg());
  // Home-screen icons use the dark tone (lime Р on black) so they stay readable when iOS darkens them in dark mode.
  await png(brandSvg({ rx: 9.6, tone: "dark" }), "public/icons/icon-192.png", 192);
  await png(brandSvg({ rx: 9.6, tone: "dark" }), "public/icons/icon-512.png", 512);
  // maskable: full-bleed background, glyph inside the 80% safe zone
  await png(brandSvg({ rx: 0, scale: 0.78, tone: "dark" }), "public/icons/icon-maskable-512.png", 512);
  // Android 13+ themed icons: the launcher recolours this silhouette to match the wallpaper / dark theme
  await png(brandSvg({ scale: 0.78, tone: "mono" }), "public/icons/icon-monochrome-512.png", 512);
  // iOS rounds the corners itself
  await png(brandSvg({ rx: 0, scale: 0.9, tone: "dark" }), "public/icons/apple-touch-icon.png", 180);
  await png(brandSvg({ rx: 7 }), "public/favicon.png", 48);
  // Telegram bot avatar (BotFather /setuserpic): square, Telegram crops it to a circle
  await png(brandSvg({ rx: 0, scale: 0.82 }), "public/brand/bot-avatar-640.png", 640);
  console.log("icons generated");
}
main();
