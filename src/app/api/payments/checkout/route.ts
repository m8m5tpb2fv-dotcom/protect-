import { api, body } from "@/server/http/handler";
import { checkoutSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { checkout } from "@/server/payments";

export const POST = api(async (req) => {
  const { productId, promoCode } = await body(req, checkoutSchema);
  return checkout(await requireUser(), productId, promoCode || undefined);
}, { rate: { limit: 10, windowMs: 10 * 60_000, key: "checkout" } });
