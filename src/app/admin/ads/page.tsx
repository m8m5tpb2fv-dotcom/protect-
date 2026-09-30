import { pageAdmin } from "@/server/auth/session";
import { adminAds } from "@/server/services/admin";
import { channelOn } from "@/server/billing";
import { getCatalog } from "@/server/services/catalog";
import { AdminAction } from "@/components/admin/action-button";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminPage, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort, isFuture } from "@/lib/format";

const SLOT = { home: "Главная", category: "Категория", search: "Поиск" } as const;

export default async function AdminAds() {
  const me = await pageAdmin();
  const [rows, catalog] = await Promise.all([adminAds(), getCatalog()]);
  const on = channelOn("ads");
  return (
    <AdminPage
      title="Реклама"
      subtitle={
        <>
          Рекламные места с пометкой «Реклама», рекламодателем и токеном erid (маркировка по 38-ФЗ).{" "}
          {on ? <Badge tone="success">Показывается</Badge> : <Badge tone="neutral">Канал выключен — объявления не показываются</Badge>}
        </>
      }
    >
      {me.role === "admin" && (
        <section className="mb-5 rounded-[22px] bezel p-5">
          <AdminForm
            type="ad.create"
            fields={[
              { name: "slot", label: "Место", kind: "select", required: true, options: Object.entries(SLOT).map(([v, l]) => ({ v, l })) },
              { name: "categoryId", label: "Только в категории", kind: "select", options: catalog.categories.map((c) => ({ v: String(c.id), l: c.name })) },
              { name: "title", label: "Заголовок", required: true },
              { name: "body", label: "Текст" },
              { name: "linkUrl", label: "Ссылка", placeholder: "https://", required: true },
              { name: "advertiser", label: "Рекламодатель (ИНН/название)", required: true },
              { name: "erid", label: "Токен erid" },
              { name: "startsAt", label: "С", kind: "date", required: true },
              { name: "endsAt", label: "По", kind: "date", required: true },
            ]}
            submitLabel="Создать"
          />
        </section>
      )}
      <Table head={["Объявление", "Место", "Период", "Показы", "Клики", "Статус", ""]} empty={!rows.length}>
        {rows.map((r) => {
          const live = r.isActive && !isFuture(r.startsAt) && isFuture(r.endsAt);
          return (
            <tr key={r.id}>
              <td className="max-w-[320px]">
                <p className="font-semibold">{r.title}</p>
                <p className="text-[12px] text-muted">
                  {r.advertiser}
                  {r.erid ? ` · erid ${r.erid}` : " · без erid"}
                </p>
              </td>
              <td>{SLOT[r.slot]}</td>
              <td>
                {dateShort(r.startsAt)} — {dateShort(r.endsAt)}
              </td>
              <td className="tabular">{r.impressions}</td>
              <td className="tabular">
                {r.clicks}
                {r.impressions > 0 && <span className="text-[12px] text-muted"> ({((r.clicks / r.impressions) * 100).toFixed(1)}%)</span>}
              </td>
              <td>
                <Badge tone={live ? "success" : "neutral"}>{live ? "Идёт" : r.isActive ? "Вне периода" : "Выключено"}</Badge>
              </td>
              <td>{me.role === "admin" && <AdminAction payload={{ type: "ad.toggle", id: r.id, isActive: !r.isActive }} label={r.isActive ? "Выключить" : "Включить"} />}</td>
            </tr>
          );
        })}
      </Table>
    </AdminPage>
  );
}
