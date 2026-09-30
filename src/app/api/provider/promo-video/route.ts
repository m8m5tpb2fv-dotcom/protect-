import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { setPromoVideo } from "@/server/billing";

const schema = z.object({ url: z.string().max(200).nullable() });

/** «Продвижение»: work video at the top of the profile (uploaded first via /api/uploads, purpose "promo"). */
export const PUT = api(async (req) => {
  const { url } = await body(req, schema);
  return setPromoVideo(await requireUser(), url);
});
