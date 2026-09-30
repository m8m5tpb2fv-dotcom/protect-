import Link from "next/link";
import { pageAdmin } from "@/server/auth/session";
import { adminReviews } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/rating";
import { dateShort } from "@/lib/format";

export default async function AdminReviews({ searchParams }: PageProps<"/admin/reviews">) {
  await pageAdmin();
  const p = await searchParams;
  const q = sp(p.q);
  const status = sp(p.status);
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminReviews({ q, status, page });
  return (
    <AdminPage title="Отзывы" subtitle={`${data.total} отзывов`}>
      <Filters base="/admin/reviews" q={q} status={status} statuses={[{ v: "", l: "Все" }, { v: "visible", l: "Опубликованные" }, { v: "hidden", l: "Скрытые" }]} />
      <Table head={["Оценка", "Текст", "Автор", "Исполнитель", "Дата", ""]} empty={!data.rows.length}>
        {data.rows.map(({ r, authorName, providerName, providerSlug }) => (
          <tr key={r.id}>
            <td>
              <Stars value={r.rating} size={13} />
            </td>
            <td className="max-w-[360px]">
              {r.text || <span className="text-muted">без текста</span>}
              {r.status === "hidden" && (
                <div className="mt-1">
                  <Badge tone="danger">Скрыт</Badge>
                </div>
              )}
            </td>
            <td>{authorName}</td>
            <td>
              <Link href={`/provider/${providerSlug}`} className="underline">
                {providerName}
              </Link>
            </td>
            <td>{dateShort(r.createdAt)}</td>
            <td>
              <AdminAction payload={{ type: "review.visibility", id: r.id, status: r.status === "visible" ? "hidden" : "visible" }} label={r.status === "visible" ? "Скрыть" : "Показать"} variant={r.status === "visible" ? "danger" : "secondary"} />
            </td>
          </tr>
        ))}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/reviews" params={{ q, status }} />
    </AdminPage>
  );
}
