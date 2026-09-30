import { api, body } from "@/server/http/handler";
import { reviewSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { leaveReview } from "@/server/services/orders";

export const POST = api<{ id: string }>(async (req, { id }) => {
  const r = await leaveReview(await requireUser(), id, await body(req, reviewSchema));
  return { id: r.id };
});
