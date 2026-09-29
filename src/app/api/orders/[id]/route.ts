import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { getOrderDetail } from "@/server/services/orders";

export const GET = api<{ id: string }>(async (_req, { id }) => getOrderDetail(id, await requireUser()));
