import { storage } from "@/server/storage";

/** Public uploads. Keys under private/ are never served here. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (key.startsWith("private/") || key.includes("..") || !/^[\w\-./]+$/.test(key)) return new Response("Not found", { status: 404 });
  const s = storage();
  const direct = s.publicUrl(key);
  if (direct) return Response.redirect(direct, 302);
  const file = await s.get(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" },
  });
}
