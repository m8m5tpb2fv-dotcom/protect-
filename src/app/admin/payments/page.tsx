import { requireAdmin } from "@/server/auth/session";
import { adminPayments } from "@/server/services/admin";
import { gateway } from "@/server/payments";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort, rub } from "@/lib/format";

export default async function AdminPayments({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  const p = await searchParams;
  const status = sp(p.status);
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminPayments({ status, page });
  const gw = gateway();
  return (
    <AdminPage title="Платежи" subtitle={<>Шлюз: <b>{gw.id}</b> {gw.isTest ? <Badge tone="warning">ТЕСТОВЫЙ РЕЖИМ</Badge> : <Badge tone="success">PRODUCTION</Badge>}</>}>
      <Filters base="/admin/payments" status={status} statuses={[{ v: "", l: "Все" }, { v: "succeeded", l: "Оплачены" }, { v: "pending", l: "Ожидают" }, { v: "failed", l: "Ошибка" }]} />
      <Table head={["Дата", "Плательщик", "Продукт", "Сумма", "Шлюз", "Статус"]} empty={!data.rows.length}>
        {data.rows.map(({ p: pay, userName, providerName }) => (
          <tr key={pay.id}>
            <td>{dateShort(pay.createdAt)}</td>
            <td>{providerName ?? userName}</td>
            <td>{pay.productId}</td>
            <td className="tabular">
              {rub(pay.amount - pay.discount)}
              {pay.discount > 0 && <span className="text-[12px] text-muted"> (скидка {rub(pay.discount)})</span>}
            </td>
            <td>
              {pay.gateway} {pay.isTest && <Badge tone="warning">тест</Badge>}
            </td>
            <td>
              <Badge tone={pay.status === "succeeded" ? "success" : pay.status === "pending" ? "warning" : "danger"}>{pay.status}</Badge>
              {pay.failureReason && <p className="text-[12px] text-muted">{pay.failureReason}</p>}
            </td>
          </tr>
        ))}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/payments" params={{ status }} />
    </AdminPage>
  );
}
