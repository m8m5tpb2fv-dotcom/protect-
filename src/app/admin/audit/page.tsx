import { requireAdmin } from "@/server/auth/session";
import { adminAudit } from "@/server/services/admin";
import { AdminPage, sp, Table } from "@/components/admin/table";
import { dateShort, time } from "@/lib/format";
import Link from "next/link";

export default async function AdminAudit({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const page = Number(sp((await searchParams).page) ?? 1) || 1;
  const data = await adminAudit(page);
  return (
    <AdminPage title="Журнал действий" subtitle="Все действия администраторов и модераторов">
      <Table head={["Время", "Кто", "Действие", "Объект", "Данные"]} empty={!data.rows.length}>
        {data.rows.map(({ a, adminName }) => (
          <tr key={a.id}>
            <td className="whitespace-nowrap">
              {dateShort(a.createdAt)}, {time(a.createdAt)}
            </td>
            <td>{adminName ?? "—"}</td>
            <td className="font-mono text-[12.5px]">{a.action}</td>
            <td className="font-mono text-[12px] text-muted">
              {a.targetType}:{a.targetId.slice(0, 8)}
            </td>
            <td className="max-w-[320px] truncate font-mono text-[12px] text-muted">{JSON.stringify(a.data)}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-6 flex justify-center gap-4 text-[14px] font-semibold">
        {page > 1 && <Link href={`/admin/audit?page=${page - 1}`}>← Новее</Link>}
        {data.rows.length === data.pageSize && <Link href={`/admin/audit?page=${page + 1}`}>Старше →</Link>}
      </div>
    </AdminPage>
  );
}
