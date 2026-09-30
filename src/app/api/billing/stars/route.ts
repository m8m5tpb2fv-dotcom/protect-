import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { startStarsCheckout } from "@/server/billing";

const schema = z.object({ productId: z.string().max(40) });

/** Telegram Stars checkout link. The service is activated by the bot's successful_payment update, never here. */
export const POST = api(
  async (req) => {
    const { productId } = await body(req, schema);
    return startStarsCheckout(await requireUser(), productId);
  },
  { rate: { limit: 20, windowMs: 10 * 60_000, key: "billing-stars" } },
);
