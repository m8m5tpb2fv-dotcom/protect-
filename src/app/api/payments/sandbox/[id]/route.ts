import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { sandboxComplete } from "@/server/payments";

export const POST = api<{ id: string }>(async (req, { id }) => {
  const { outcome } = await body(req, z.object({ outcome: z.enum(["success", "fail"]) }));
  return sandboxComplete(await requireUser(), id, outcome);
});
