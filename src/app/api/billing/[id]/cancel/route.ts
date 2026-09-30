import { z } from "zod";
import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { cancelInvoice } from "@/server/billing";

export const POST = api<{ id: string }>(async (_req, { id }) => {
  await cancelInvoice(await requireUser(), z.string().uuid().parse(id));
  return { ok: true };
});
