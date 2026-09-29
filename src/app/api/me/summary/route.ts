import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { summary } from "@/server/services/account";

export const GET = api(async () => summary(await requireUser()));
