import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { toggleFavorite } from "@/server/services/account";

export const POST = api<{ providerId: string }>(async (_req, { providerId }) => {
  if (!/^[0-9a-f-]{36}$/.test(providerId)) return { favorite: false };
  return toggleFavorite((await requireUser()).id, providerId);
});
