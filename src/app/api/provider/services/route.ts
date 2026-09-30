import { api, body } from "@/server/http/handler";
import { providerServiceSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { addService } from "@/server/services/provider-self";

export const POST = api(async (req) => ({ service: await addService(await requireUser(), await body(req, providerServiceSchema)) }));
