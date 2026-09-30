import { requireAdmin } from "@/server/auth/session";
import { errorResponse } from "@/server/http/handler";
import { notFound } from "@/server/http/errors";
import { getDocument, audit } from "@/server/services/admin";
import { storage } from "@/server/storage";

/** Private identity documents: admins only, never cached. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const doc = await getDocument(id);
    if (!doc) throw notFound();
    const file = await storage().get(doc.fileKey);
    if (!file) throw notFound("Файл не найден");
    await audit(admin, "document.view", "document", id);
    return new Response(new Uint8Array(file.data), { headers: { "content-type": file.contentType, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-disposition": "inline" } });
  } catch (e) {
    return errorResponse(e);
  }
}
