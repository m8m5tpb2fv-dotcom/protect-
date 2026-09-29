import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { addDocument } from "@/server/services/provider-self";

export const POST = api(async (req) => {
  const { kind, url } = await body(req, z.object({ kind: z.enum(["passport", "diploma", "business", "other"]), url: z.string().max(300) }));
  return addDocument(await requireUser(), kind, url);
});
