import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { replyToReview } from "@/server/services/orders";

export const POST = api<{ id: string }>(async (req, { id }) => {
  const { reply } = await body(req, z.object({ reply: z.string().trim().min(2).max(1000) }));
  await replyToReview(await requireUser(), id, reply);
  return { ok: true };
});
