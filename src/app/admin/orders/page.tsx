import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { adminOrders } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { OrderStatusBadge } from "@/components/domain/order-card";
import { dateShort, rub } from "@/lib/format";

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const p = await searchParams;
  const q = sp(p.q);
  const status = sp(p.status);
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminOrders({ q, status, page });
  return (
    <AdminPage title="Заказы" subtitle={`${data.total} заказов`}>
      <Filters base="/admin/orders" q={q} status={status} statuses={[{ v: "", l: "Все" }, { v: "new", l: "Новые" }, { v: "responses", l: "С откликами" }, { v: "in_progress", l: "В работе" }, { v: "completed", l: "Завершённые" }, { v: "cancelled", l: "Отменённые" }]} />
      <Table head={["№", "Заказ", "Клиент", "Исполнитель", "Статус", "Сумма", "Дата", ""]} empty={!data.rows.length}>
        {data.rows.map(({ o, subName, clientName, providerName }) => (
          <tr key={o.id}>
            <td className="tabular text-muted">{o.number}</td>
            <td>
              <Link href={`/orders/${o.id}`} className="font-semibold hover:underline">
                {o.title}
              </Link>
              <p className="text-[12px] text-muted">{subName}</p>
            </td>
            <td>{clientName}</td>
            <td>{providerName ?? "—"}</td>
            <td>
              <OrderStatusBadge status={o.status} />
            </td>
            <td className="tabular">
              {o.agreedPrice != null ? rub(o.agreedPrice) : "—"}
              {o.commissionAmount ? <p className="text-[12px] text-muted">комиссия {rub(o.commissionAmount)}</p> : null}
            </td>
            <td>{dateShort(o.createdAt)}</td>
            <td>{!["completed", "cancelled"].includes(o.status) && <AdminAction payload={{ type: "order.cancel", id: o.id }} label="Отменить" prompt="Причина отмены" promptKey="reason" variant="danger" />}</td>
          </tr>
        ))}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/orders" params={{ q, status }} />
    </AdminPage>
  );
}
