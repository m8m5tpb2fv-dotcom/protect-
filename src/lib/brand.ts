/**
 * Brand mark «Р-метка»: the letter Р whose bowl is a map pin («здесь, рядом»).
 * Single source for the React logo, favicon/PWA icons, bot avatar and covers (scripts/icons.ts).
 * Geometry is in a 32×32 box; the glyph is optically centred.
 */
export const BRAND = { accent: "#d4f25c", ink: "#0b0b0c" } as const;

/** Glyph markup (no <svg> wrapper). `ink` may be a CSS variable. */
export function brandGlyph(ink: string = BRAND.ink) {
  return (
    `<g transform="translate(-1.1 -0.3)">` +
    `<rect x="8.6" y="6.6" width="4.4" height="19.4" rx="2.2" fill="${ink}"/>` +
    `<circle cx="17.4" cy="13" r="6.4" fill="none" stroke="${ink}" stroke-width="4.2"/>` +
    `<circle cx="17.4" cy="13" r="1.9" fill="${ink}"/>` +
    `</g>`
  );
}

/**
 * Standalone SVG: tile + glyph.
 * `rx` in 32-units (0 = square, for maskable icons); `scale` shrinks the glyph (maskable safe zone).
 * `tone`: "lime" = black Р on lime (favicon, bot avatar); "dark" = lime Р on black — used for home-screen
 * icons, because iOS darkens web-clip icons in dark mode by itself and a black Р on a darkened tile disappears.
 * `tone: "mono"` = white glyph on transparent (Android themed/monochrome icon).
 */
export function brandSvg({ size = 32, rx = 10, scale = 1, tone = "lime" }: { size?: number; rx?: number; scale?: number; tone?: "lime" | "dark" | "mono" } = {}) {
  const ink = tone === "lime" ? BRAND.ink : tone === "dark" ? BRAND.accent : "#ffffff";
  const glyph = brandGlyph(ink);
  const g = scale === 1 ? glyph : `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${glyph}</g>`;
  const bg = tone === "mono" ? "" : `<rect width="32" height="32" rx="${rx}" fill="${tone === "lime" ? BRAND.accent : BRAND.ink}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${bg}${g}</svg>`;
}
