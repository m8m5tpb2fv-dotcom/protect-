import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { listNotifications } from "@/server/services/account";

export const GET = api(async () => ({ notifications: await listNotifications((await requireUser()).id) }));
