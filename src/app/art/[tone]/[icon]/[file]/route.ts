import { renderArt } from "@/server/art";

/** Deterministic SVG illustrations: /art/<tone>/<Icon>/<seed>.svg?w=&h=&dark=1 */
export async function GET(req: Request, ctx: { params: Promise<{ tone: string; icon: string; file: string }> }) {
  const { tone, icon, file } = await ctx.params;
  const url = new URL(req.url);
  const clamp = (v: string | null, d: number) => Math.min(2400, Math.max(64, Number(v) || d));
  if (!/^[a-z]{2,12}$/.test(tone) || !/^[A-Za-z0-9]{2,40}$/.test(icon) || !/^[\w.-]{1,120}$/.test(file)) return new Response("bad request", { status: 400 });
  const svg = renderArt({ tone, icon, seed: file.replace(/\.svg$/, ""), w: clamp(url.searchParams.get("w"), 1200), h: clamp(url.searchParams.get("h"), 900), dark: url.searchParams.get("dark") === "1" });
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
  });
}
