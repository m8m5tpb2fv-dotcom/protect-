import { api, body } from "@/server/http/handler";
import { orderActionSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { orderAction } from "@/server/services/orders";

export const POST = api<{ id: string }>(async (req, { id }) => {
  const o = await orderAction(await requireUser(), id, await body(req, orderActionSchema));
  return { status: o.status };
});
