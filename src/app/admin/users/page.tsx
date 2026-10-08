import Link from "next/link";
import { pageAdmin } from "@/server/auth/session";
import { adminUsers } from "@/server/services/admin";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const me = await pageAdmin();
  const p = await searchParams;
  const q = sp(p.q);
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminUsers({ q, page });
  return (
    <AdminPage title="Пользователи" subtitle={`${data.total} аккаунтов`}>
      <Filters base="/admin/users" q={q} />
      <Table head={["Пользователь", "Контакты", "Роль", "Исполнитель", "Регистрация", "Действия"]} empty={!data.rows.length}>
        {data.rows.map(({ u, providerSlug, providerStatus }) => (
          <tr key={u.id}>
            <td>
              <p className="font-semibold">{u.name}</p>
              {u.isBlocked && <Badge tone="danger">Заблокирован</Badge>}
            </td>
            <td className="text-[12.5px]">
              {u.email && <p>{u.email}</p>}
              {u.phone && <p>{formatPhone(u.phone)}</p>}
              {u.telegramId && <p>Telegram {u.telegramUsername ? `@${u.telegramUsername}` : u.telegramId}</p>}
            </td>
            <td>
              <Badge tone={u.role === "admin" ? "ink" : u.role === "moderator" ? "info" : "neutral"}>{u.role}</Badge>
            </td>
            <td>{providerSlug ? <Link href={`/provider/${providerSlug}`} className="underline">{providerStatus}</Link> : "—"}</td>
            <td>{dateShort(u.createdAt)}</td>
            <td>
              {u.id !== me.id && (
                <div className="flex flex-wrap gap-1.5">
                  <AdminAction payload={{ type: "user.block", id: u.id, blocked: !u.isBlocked }} label={u.isBlocked ? "Разблокировать" : "Заблокировать"} variant={u.isBlocked ? "secondary" : "danger"} confirmText={u.isBlocked ? undefined : `Заблокировать ${u.name}? Все сессии будут завершены.`} />
                  {me.role === "admin" && u.role !== "moderator" && <AdminAction payload={{ type: "user.role", id: u.id, role: "moderator" }} label="Сделать модератором" variant="ghost" />}
                  {me.role === "admin" && u.role !== "admin" && (
                    <AdminAction payload={{ type: "user.role", id: u.id, role: "admin" }} label="Сделать администратором" variant="ghost" confirmText={`Дать «${u.name}» полный доступ к админке, оплатам и удалению данных?`} />
                  )}
                  {me.role === "admin" && u.role !== "user" && <AdminAction payload={{ type: "user.role", id: u.id, role: "user" }} label="Снять роль" variant="ghost" />}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/users" params={{ q }} />
    </AdminPage>
  );
}
