import { desc } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { promoCodes } from "@/server/db/schema";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort } from "@/lib/format";

export default async function AdminPromo() {
  const me = await requireAdmin();
  const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  return (
    <AdminPage title="Промокоды" subtitle="Скидки на Pro и продвижение">
      {me.role === "admin" && (
        <section className="mb-5 rounded-[22px] bg-surface p-5 shadow-card">
          <AdminForm
            type="promo.create"
            fields={[
              { name: "code", label: "Код", placeholder: "SPRING25", required: true },
              { name: "discountPct", label: "Скидка, %", kind: "number", required: true },
              { name: "maxUses", label: "Лимит использований", kind: "number" },
              { name: "validUntil", label: "Действует до", kind: "date" },
            ]}
            submitLabel="Создать"
          />
        </section>
      )}
      <Table head={["Код", "Скидка", "Использовано", "До", "Статус", ""]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-mono font-semibold">{r.code}</td>
            <td>{r.discountPct}%</td>
            <td className="tabular">
              {r.usedCount}
              {r.maxUses ? ` / ${r.maxUses}` : ""}
            </td>
            <td>{r.validUntil ? dateShort(r.validUntil) : "—"}</td>
            <td>
              <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Активен" : "Выключен"}</Badge>
            </td>
            <td>{me.role === "admin" && <AdminAction payload={{ type: "promo.toggle", id: r.id, isActive: !r.isActive }} label={r.isActive ? "Выключить" : "Включить"} />}</td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
