import { api, body } from "@/server/http/handler";
import { portfolioSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { addPortfolio } from "@/server/services/provider-self";

export const POST = api(async (req) => ({ item: await addPortfolio(await requireUser(), await body(req, portfolioSchema)) }));
