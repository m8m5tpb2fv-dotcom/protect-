import { api, body } from "@/server/http/handler";
import { ticketSchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { createTicket } from "@/server/services/account";

export const POST = api(async (req) => {
  await createTicket(await getCurrentUser(), await body(req, ticketSchema));
  return { ok: true };
}, { rate: { limit: 5, windowMs: 60 * 60_000, key: "ticket" } });
