import Link from "next/link";
import { pageAdmin } from "@/server/auth/session";
import { adminReports } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort } from "@/lib/format";
import { db } from "@/server/db";
import { providers, reviews } from "@/server/db/schema";
import { inArray } from "drizzle-orm";

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  await pageAdmin();
  const p = await searchParams;
  const status = sp(p.status) ?? "open";
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminReports({ status, page });
  const provIds = data.rows.filter((r) => r.r.targetType === "provider").map((r) => r.r.targetId);
  const revIds = data.rows.filter((r) => r.r.targetType === "review").map((r) => r.r.targetId);
  const [provs, revs] = await Promise.all([
    provIds.length ? db.select({ id: providers.id, slug: providers.slug, name: providers.displayName }).from(providers).where(inArray(providers.id, provIds)) : [],
    revIds.length ? db.select({ id: reviews.id, text: reviews.text, status: reviews.status }).from(reviews).where(inArray(reviews.id, revIds)) : [],
  ]);
  const target = (t: string, id: string) => {
    if (t === "provider") {
      const x = provs.find((p) => p.id === id);
      return x ? <Link href={`/provider/${x.slug}`} className="underline">Исполнитель: {x.name}</Link> : id;
    }
    if (t === "review") {
      const x = revs.find((r) => r.id === id);
      return x ? (
        <span>
          Отзыв: «{x.text.slice(0, 80)}» {x.status === "visible" && <AdminAction payload={{ type: "review.visibility", id, status: "hidden" }} label="Скрыть отзыв" variant="danger" />}
        </span>
      ) : id;
    }
    if (t === "order") return <Link href={`/orders/${id}`} className="underline">Заказ</Link>;
    return `${t}: ${id}`;
  };
  return (
    <AdminPage title="Жалобы" subtitle={`${data.total} ${status === "open" ? "открытых" : ""}`}>
      <Filters base="/admin/reports" status={status} statuses={[{ v: "open", l: "Открытые" }, { v: "resolved", l: "Решённые" }, { v: "rejected", l: "Отклонённые" }, { v: "all", l: "Все" }]} />
      <Table head={["Причина", "Объект", "От кого", "Дата", "Статус", ""]} empty={!data.rows.length}>
        {data.rows.map(({ r, reporterName }) => (
          <tr key={r.id}>
            <td className="max-w-[280px]">
              <p className="font-semibold">{r.reason}</p>
              {r.text && <p className="text-[12.5px] text-muted">{r.text}</p>}
            </td>
            <td>{target(r.targetType, r.targetId)}</td>
            <td>{reporterName}</td>
            <td>{dateShort(r.createdAt)}</td>
            <td>
              <Badge tone={r.status === "open" ? "warning" : r.status === "resolved" ? "success" : "neutral"}>{r.status}</Badge>
              {r.resolution && <p className="text-[12px] text-muted">{r.resolution}</p>}
            </td>
            <td>
              {r.status === "open" && (
                <div className="flex gap-1.5">
                  <AdminAction payload={{ type: "report.resolve", id: r.id, status: "resolved" }} label="Решено" variant="accent" prompt="Что сделано?" promptKey="resolution" />
                  <AdminAction payload={{ type: "report.resolve", id: r.id, status: "rejected" }} label="Отклонить" variant="ghost" />
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/reports" params={{ status }} />
    </AdminPage>
  );
}
