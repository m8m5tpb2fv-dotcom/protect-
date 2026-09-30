import Link from "next/link";
import { pageAdmin } from "@/server/auth/session";
import { adminProviders } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort, rating } from "@/lib/format";
import { db } from "@/server/db";
import { providerDocuments } from "@/server/db/schema";
import { inArray } from "drizzle-orm";

const STATUS: Record<string, [string, "warning" | "success" | "danger" | "neutral"]> = { pending: ["На модерации", "warning"], active: ["Активен", "success"], rejected: ["Отклонён", "danger"], suspended: ["Приостановлен", "danger"], draft: ["Черновик", "neutral"] };

export default async function AdminProviders({ searchParams }: PageProps<"/admin/providers">) {
  await pageAdmin();
  const p = await searchParams;
  const q = sp(p.q);
  const status = sp(p.status);
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminProviders({ q, status, page });
  const docs = data.rows.length ? await db.select().from(providerDocuments).where(inArray(providerDocuments.providerId, data.rows.map((r) => r.p.id))) : [];
  return (
    <AdminPage title="Исполнители" subtitle={`${data.total} профилей`}>
      <Filters base="/admin/providers" q={q} status={status} statuses={[{ v: "", l: "Все" }, { v: "pending", l: "На модерации" }, { v: "active", l: "Активные" }, { v: "rejected", l: "Отклонённые" }, { v: "suspended", l: "Приостановленные" }]} />
      <Table head={["Исполнитель", "Специализация", "Статус", "Проверка", "Рейтинг", "Документы", "Действия"]} empty={!data.rows.length}>
        {data.rows.map(({ p: pr, subName, email }) => {
          const [label, tone] = STATUS[pr.status];
          const d = docs.filter((x) => x.providerId === pr.id);
          return (
            <tr key={pr.id}>
              <td>
                <Link href={`/provider/${pr.slug}`} className="font-semibold hover:underline" target="_blank">
                  {pr.displayName}
                </Link>
                <p className="text-[12px] text-muted">
                  {email} · с {dateShort(pr.createdAt)}
                </p>
                {pr.moderationNote && <p className="mt-1 text-[12px] text-danger">{pr.moderationNote}</p>}
              </td>
              <td>{subName}</td>
              <td>
                <Badge tone={tone}>{label}</Badge>
              </td>
              <td>{pr.verification === "none" ? "—" : pr.verification}</td>
              <td className="tabular">
                {pr.reviewsCount ? rating(pr.ratingAvg) : "—"} <span className="text-muted">({pr.reviewsCount})</span>
              </td>
              <td>
                {d.length ? (
                  <ul className="space-y-1">
                    {d.map((x) => (
                      <li key={x.id}>
                        <a href={`/api/admin/documents/${x.id}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold underline">
                          {x.kind}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">нет</span>
                )}
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  {pr.status !== "active" && <AdminAction payload={{ type: "provider.approve", id: pr.id }} label="Одобрить" variant="accent" />}
                  {pr.status !== "active" && d.length > 0 && <AdminAction payload={{ type: "provider.approve", id: pr.id, verification: "verified" }} label="Одобрить + проверен" variant="primary" />}
                  {pr.status === "pending" && <AdminAction payload={{ type: "provider.reject", id: pr.id }} label="Отклонить" prompt="Что нужно исправить?" variant="danger" />}
                  {pr.status === "active" && <AdminAction payload={{ type: "provider.suspend", id: pr.id }} label="Приостановить" prompt="Причина" variant="danger" />}
                  {pr.status === "active" && pr.verification === "none" && <AdminAction payload={{ type: "provider.verification", id: pr.id, verification: "verified" }} label="Проверен" />}
                  {pr.status === "active" && pr.verification !== "none" && <AdminAction payload={{ type: "provider.verification", id: pr.id, verification: "none" }} label="Снять проверку" variant="ghost" />}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/providers" params={{ q, status }} />
    </AdminPage>
  );
}
