import { api, body } from "@/server/http/handler";
import { respondSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { respondToOrder } from "@/server/services/orders";

export const POST = api<{ id: string }>(async (req, { id }) => {
  const r = await respondToOrder(await requireUser(), id, await body(req, respondSchema));
  return { id: r.resp.id, conversationId: r.conversationId };
});
