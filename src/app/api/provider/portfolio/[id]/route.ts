import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { deletePortfolio } from "@/server/services/provider-self";

export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  await deletePortfolio(await requireUser(), id);
  return { ok: true };
});
