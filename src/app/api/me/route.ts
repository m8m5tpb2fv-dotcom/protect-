import { api, body } from "@/server/http/handler";
import { profileUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { updateProfile } from "@/server/services/account";

export const GET = api(async () => ({ user: await requireUser() }));

export const PATCH = api(async (req) => {
  await updateProfile(await requireUser(), await body(req, profileUpdateSchema));
  return { ok: true };
});
