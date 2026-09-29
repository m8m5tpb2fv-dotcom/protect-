import { api } from "@/server/http/handler";
import { handleYookassaWebhook } from "@/server/payments";

/** YooKassa HTTP notifications. The body is not trusted: status is re-fetched from the API. */
export const POST = api(async (req) => {
  await handleYookassaWebhook(await req.json().catch(() => null));
  return { ok: true };
}, { public: true, rate: { limit: 300, windowMs: 60_000, key: "yk" } });
