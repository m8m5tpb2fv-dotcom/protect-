import { api, body } from "@/server/http/handler";
import { providerServiceSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { deleteService, updateService } from "@/server/services/provider-self";

export const PUT = api<{ id: string }>(async (req, { id }) => ({ service: await updateService(await requireUser(), id, await body(req, providerServiceSchema)) }));
export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  await deleteService(await requireUser(), id);
  return { ok: true };
});
