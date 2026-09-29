import * as lucide from "lucide";
import { TONES } from "@/lib/tones";

/**
 * Deterministic editorial illustrations used for demo covers & portfolio.
 * Real providers upload photos; these keep the demo visually rich without
 * hot-linking third-party photography or using real people's images.
 */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type IconNode = [string, Record<string, string | number>][];

function iconMarkup(name: string): string {
  const node = (lucide as unknown as Record<string, IconNode>)[name] ?? (lucide as unknown as Record<string, IconNode>).Sparkles;
  return node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
}

export type ArtOptions = { tone: string; icon: string; seed: string; w?: number; h?: number; dark?: boolean };

export function renderArt({ tone, icon, seed, w = 1200, h = 900 }: ArtOptions): string {
  const t = TONES[tone] ?? TONES.stone;
  const r = rng(hashString(seed));
  const id = `g${hashString(seed + tone).toString(36)}`;
  const big = Math.max(w, h);
  // moody base: deep ink of the category → its saturated mid-tone
  const base0 = mix(t.ink, "#000000", 0.55);
  const base1 = mix(t.c, t.ink, 0.35 + r() * 0.2);
  const angle = Math.round(r() * 360);
  const blobs = [t.c, mix(t.c, t.b, 0.4), mix(t.b, "#ffffff", 0.2), mix(t.c, "#000000", 0.25)]
    .map((col, i) => {
      const bx = (0.1 + r() * 0.8) * w;
      const by = (i === 2 ? 0.1 + r() * 0.35 : 0.3 + r() * 0.7) * h;
      const rx = big * (i === 2 ? 0.12 + r() * 0.12 : 0.2 + r() * 0.24);
      const ry = rx * (0.55 + r() * 0.5);
      return `<ellipse cx="${bx.toFixed(0)}" cy="${by.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${col}" opacity="${i === 2 ? 0.5 : 0.85}"/>`;
    })
    .join("");
  // subtle dotted texture (dot-matrix reference) on a third of images
  const dots =
    r() < 0.33
      ? `<pattern id="${id}p" width="${big * 0.022}" height="${big * 0.022}" patternUnits="userSpaceOnUse"><circle cx="${big * 0.011}" cy="${big * 0.011}" r="${big * 0.0035}" fill="#fff" opacity=".22"/></pattern><rect width="${w}" height="${h}" fill="url(#${id}p)"/>`
      : "";
  const iconSize = big * (0.16 + r() * 0.06);
  const ix = w - iconSize - big * 0.06;
  const iy = h - iconSize - big * 0.06;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="${id}" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${base0}"/><stop offset="1" stop-color="${base1}"/></linearGradient>
<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(big * 0.085).toFixed(0)}"/></filter>
<filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency="${(700 / big).toFixed(3)}" numOctaves="2" seed="${Math.floor(r() * 100)}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter>
<radialGradient id="${id}v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#${id})"/>
<g filter="url(#${id}b)">${blobs}</g>
${dots}
<rect width="${w}" height="${h}" filter="url(#${id}n)" opacity=".4" style="mix-blend-mode:overlay"/>
<rect width="${w}" height="${h}" fill="url(#${id}v)"/>
<g transform="translate(${ix.toFixed(0)} ${iy.toFixed(0)}) scale(${(iconSize / 24).toFixed(3)})" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${iconMarkup(icon)}</g>
</svg>`;
}

function mix(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) * (1 - k) + ch(pb, s) * k);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, "0")}`;
}
