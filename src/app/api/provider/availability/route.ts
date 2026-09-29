import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { setAvailability } from "@/server/services/provider-self";

export const POST = api(async (req) => {
  const { isAvailable } = await body(req, z.object({ isAvailable: z.boolean() }));
  await setAvailability(await requireUser(), isAvailable);
  return { isAvailable };
});
