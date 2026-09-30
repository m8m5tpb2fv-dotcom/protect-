import { api, body } from "@/server/http/handler";
import { createOrderSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { getCurrentCity } from "@/server/services/catalog";
import { createOrder, listClientOrders } from "@/server/services/orders";

export const GET = api(async () => ({ orders: await listClientOrders((await requireUser()).id) }));

export const POST = api(
  async (req) => {
    const user = await requireUser();
    const input = await body(req, createOrderSchema);
    const city = await getCurrentCity();
    const order = await createOrder(user, input, city.id);
    return { id: order.id, number: order.number };
  },
  { rate: { limit: 10, windowMs: 60 * 60_000, key: "order-create" } },
);
