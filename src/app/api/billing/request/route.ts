import { api, body } from "@/server/http/handler";
import { serviceRequestSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { requestService } from "@/server/billing";

/** Request for a paid platform service. No payment is taken here — an invoice is issued outside the platform. */
export const POST = api(async (req) => {
  const { productId, promoCode } = await body(req, serviceRequestSchema);
  const inv = await requestService(await requireUser(), productId, promoCode || undefined);
  return { id: inv.id, status: inv.status };
}, { rate: { limit: 10, windowMs: 10 * 60_000, key: "billing-request" } });
