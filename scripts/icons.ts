/* Generates PNG app icons from the SVG mark. Run: npx tsx scripts/icons.ts */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const mark = (size: number, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${pad ? 0 : size * 0.3}" fill="#d4f25c"/><circle cx="${size / 2}" cy="${size / 2}" r="${(size / 2 - pad) * 0.56}" fill="none" stroke="#0d0d0f" stroke-opacity=".22" stroke-width="${size * 0.05}"/><circle cx="${size / 2}" cy="${size / 2}" r="${(size / 2 - pad) * 0.28}" fill="#0d0d0f"/></svg>`;

async function main() {
  mkdirSync("public/icons", { recursive: true });
  await sharp(Buffer.from(mark(192))).png().toFile("public/icons/icon-192.png");
  await sharp(Buffer.from(mark(512))).png().toFile("public/icons/icon-512.png");
  await sharp(Buffer.from(mark(512, 80))).png().toFile("public/icons/icon-maskable-512.png");
  await sharp(Buffer.from(mark(180, 20))).png().toFile("public/icons/apple-touch-icon.png");
  await sharp(Buffer.from(mark(48))).png().toFile("public/favicon.png");
  console.log("icons generated");
}
main();
