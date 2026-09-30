import { api, body } from "@/server/http/handler";
import { reportSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { createReport } from "@/server/services/account";

export const POST = api(async (req) => {
  await createReport((await requireUser()).id, await body(req, reportSchema));
  return { ok: true };
});
