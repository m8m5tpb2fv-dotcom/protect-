import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { markNotificationsRead } from "@/server/services/account";

export const POST = api(async (req) => {
  const { ids } = await body(req, z.object({ ids: z.array(z.string().uuid()).max(200).optional() }));
  await markNotificationsRead((await requireUser()).id, ids);
  return { ok: true };
});
