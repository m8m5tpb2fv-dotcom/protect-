import type { CSSProperties } from "react";

/** Category tones — the only place with extra hues; used for illustrations & tiles, never for UI chrome. */
export const TONES: Record<string, { a: string; b: string; c: string; ink: string }> = {
  amber: { a: "#F6E7CF", b: "#E9B872", c: "#C97B2E", ink: "#3B2410" },
  sage: { a: "#E4EEE4", b: "#A9C5A8", c: "#5F8B63", ink: "#1D3322" },
  slate: { a: "#E3E7EE", b: "#9AA8BE", c: "#4E5D78", ink: "#161D2B" },
  rose: { a: "#F7E4E4", b: "#E6A9AE", c: "#B8616D", ink: "#3A161C" },
  indigo: { a: "#E6E6F7", b: "#A9ABE3", c: "#5A5CB8", ink: "#1A1B45" },
  lime: { a: "#EEF6D8", b: "#C8E27A", c: "#7EA227", ink: "#253312" },
  violet: { a: "#EEE6F6", b: "#BFA3E0", c: "#7D56B0", ink: "#2A1A40" },
  cyan: { a: "#E0F1F4", b: "#93CDD8", c: "#2F8797", ink: "#0E2C33" },
  orange: { a: "#FBE6D8", b: "#F2A97A", c: "#D2642A", ink: "#3D1D0C" },
  stone: { a: "#EEEBE6", b: "#C4BBAE", c: "#7F7466", ink: "#2A251F" },
  fuchsia: { a: "#F8E3F1", b: "#E7A2D0", c: "#B34E93", ink: "#3A1230" },
  clay: { a: "#F3E6DD", b: "#D6A98C", c: "#9C5F3E", ink: "#33190C" },
};

export function toneStyle(tone: string): CSSProperties {
  const t = TONES[tone] ?? TONES.stone;
  return {
    ["--t-a" as string]: t.a,
    ["--t-b" as string]: t.b,
    ["--t-c" as string]: t.c,
    ["--t-ink" as string]: t.ink,
  };
}
