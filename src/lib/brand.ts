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
 * Standalone SVG: lime tile + glyph.
 * `rx` in 32-units (0 = square, for maskable icons); `scale` shrinks the glyph (maskable safe zone).
 */
export function brandSvg({ size = 32, rx = 10, scale = 1 }: { size?: number; rx?: number; scale?: number } = {}) {
  const g = scale === 1 ? brandGlyph() : `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${brandGlyph()}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="${rx}" fill="${BRAND.accent}"/>${g}</svg>`;
}
