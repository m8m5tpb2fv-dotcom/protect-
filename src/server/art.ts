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

export function renderArt({ tone, icon, seed, w = 1200, h = 900, dark = false }: ArtOptions): string {
  const t = TONES[tone] ?? TONES.stone;
  const r = rng(hashString(seed));
  const variant = Math.floor(r() * 4);
  const bgA = dark ? t.ink : t.a;
  const bgB = dark ? mix(t.ink, t.c, 0.35) : t.b;
  const id = `g${hashString(seed + tone).toString(36)}`;
  const cx = (0.25 + r() * 0.5) * w;
  const cy = (0.25 + r() * 0.5) * h;
  const big = Math.max(w, h);
  const iconSize = big * (0.38 + r() * 0.22);
  const ix = variant % 2 === 0 ? w - iconSize * 0.85 : w * 0.08;
  const iy = variant < 2 ? h - iconSize * 0.9 : h * 0.06;
  const rot = Math.round((r() - 0.5) * 24);
  const stroke = dark ? t.b : t.ink;

  const blobs = Array.from({ length: 3 }, (_, i) => {
    const bx = r() * w;
    const by = r() * h;
    const br = big * (0.18 + r() * 0.3);
    const col = i === 0 ? t.c : i === 1 ? t.b : t.a;
    return `<circle cx="${bx.toFixed(0)}" cy="${by.toFixed(0)}" r="${br.toFixed(0)}" fill="${col}" opacity="${dark ? 0.35 : 0.55}"/>`;
  }).join("");

  const shapes =
    variant === 0
      ? Array.from({ length: 5 }, (_, i) => `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(big * 0.12 * (i + 1)).toFixed(0)}" fill="none" stroke="${stroke}" stroke-opacity="0.07" stroke-width="${big * 0.0025}"/>`).join("")
      : variant === 1
        ? Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${((h / 7) * i + r() * 40).toFixed(0)}" x2="${w}" y2="${((h / 7) * i - big * 0.2).toFixed(0)}" stroke="${stroke}" stroke-opacity="0.06" stroke-width="${big * 0.002}"/>`).join("")
        : variant === 2
          ? `<rect x="${(w * 0.08).toFixed(0)}" y="${(h * 0.1).toFixed(0)}" width="${(w * 0.46).toFixed(0)}" height="${(h * 0.62).toFixed(0)}" rx="${big * 0.04}" fill="${dark ? t.c : "#ffffff"}" opacity="${dark ? 0.18 : 0.42}"/>`
          : `<path d="M0 ${h * 0.72} C ${w * 0.3} ${h * 0.55}, ${w * 0.6} ${h * 0.95}, ${w} ${h * 0.7} L ${w} ${h} L 0 ${h} Z" fill="${t.c}" opacity="${dark ? 0.3 : 0.22}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></linearGradient>
<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(big * 0.06).toFixed(0)}"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#${id})"/>
<g filter="url(#${id}b)">${blobs}</g>
${shapes}
<g transform="translate(${ix.toFixed(0)} ${iy.toFixed(0)}) rotate(${rot} ${iconSize / 2} ${iconSize / 2}) scale(${(iconSize / 24).toFixed(3)})" fill="none" stroke="${stroke}" stroke-opacity="${dark ? 0.55 : 0.78}" stroke-width="${variant === 2 ? 0.9 : 0.7}" stroke-linecap="round" stroke-linejoin="round">${iconMarkup(icon)}</g>
</svg>`;
}

function mix(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) * (1 - k) + ch(pb, s) * k);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, "0")}`;
}
