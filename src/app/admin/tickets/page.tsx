import { pageAdmin } from "@/server/auth/session";
import { adminTickets } from "@/server/services/admin";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, AdminPagination, Filters, sp } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort } from "@/lib/format";

export default async function AdminTickets({ searchParams }: PageProps<"/admin/tickets">) {
  await pageAdmin();
  const p = await searchParams;
  const status = sp(p.status);
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminTickets({ status, page });
  return (
    <AdminPage title="Обращения" subtitle={`${data.total} обращений`}>
      <Filters base="/admin/tickets" status={status} statuses={[{ v: "", l: "Все" }, { v: "open", l: "Открытые" }, { v: "answered", l: "Отвеченные" }, { v: "closed", l: "Закрытые" }]} />
      <ul className="flex flex-col gap-3">
        {data.rows.map(({ t, userName, userEmail }) => (
          <li key={t.id} className="rounded-[22px] bezel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[16px] font-semibold">{t.subject}</p>
              <Badge tone={t.status === "open" ? "warning" : t.status === "answered" ? "success" : "neutral"}>{t.status}</Badge>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">
              {userName ?? "Гость"} · {userEmail ?? t.email} · {dateShort(t.createdAt)}
            </p>
            <p className="mt-3 whitespace-pre-line text-[14.5px]">{t.body}</p>
            {t.answer && <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px]">Ответ: {t.answer}</p>}
            {t.status !== "closed" && (
              <div className="mt-4 flex flex-col gap-2">
                <AdminForm type="ticket.answer" fixed={{ id: t.id, close: false }} fields={[{ name: "answer", label: "Ответ", kind: "textarea", required: true }]} submitLabel="Ответить" className="flex flex-col gap-3" />
                <div>
                  <AdminAction payload={{ type: "ticket.answer", id: t.id, answer: t.answer ?? "Закрыто", close: true }} label="Закрыть" variant="ghost" />
                </div>
              </div>
            )}
          </li>
        ))}
        {!data.rows.length && <p className="text-[14px] text-muted">Обращений нет.</p>}
      </ul>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/tickets" params={{ status }} />
    </AdminPage>
  );
}
