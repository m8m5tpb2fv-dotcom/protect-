import { api, body } from "@/server/http/handler";
import { providerProfileSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { getCurrentCity } from "@/server/services/catalog";
import { createProviderProfile, getOwnProvider, updateProviderProfile } from "@/server/services/provider-self";

export const GET = api(async () => ({ data: await getOwnProvider(await requireUser()) }));

export const POST = api(
  async (req) => {
    const user = await requireUser();
    const input = await body(req, providerProfileSchema);
    const city = await getCurrentCity();
    const p = await createProviderProfile(user, input, city.id);
    return { id: p.id, slug: p.slug, status: p.status };
  },
  { rate: { limit: 5, windowMs: 60 * 60_000, key: "provider-create" } },
);

export const PUT = api(async (req) => updateProviderProfile(await requireUser(), await body(req, providerProfileSchema)));
