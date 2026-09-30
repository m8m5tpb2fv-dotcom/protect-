import { api, query } from "@/server/http/handler";
import { searchQuerySchema } from "@/lib/validation";
import { getCurrentCity } from "@/server/services/catalog";
import { searchProviders } from "@/server/services/providers";

export const GET = api(async (req) => {
  const q = query(req, searchQuerySchema);
  const city = await getCurrentCity();
  return searchProviders(city.id, q);
}, { rate: { limit: 90, windowMs: 60_000, key: "search" } });
