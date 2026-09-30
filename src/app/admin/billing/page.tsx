import Link from "next/link";
import { pageAdmin } from "@/server/auth/session";
import { adminInvoices } from "@/server/services/admin";
import { enabledChannels } from "@/server/billing";
import { PLANS, PROMOTIONS, getProduct } from "@/config/monetization";
import { AdminAction } from "@/components/admin/action-button";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminPage, AdminPagination, Filters, sp, Table } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { dateShort, rub } from "@/lib/format";

const STATUS = { requested: ["Ждёт оплаты", "warning"], activated: ["Подключено", "success"], cancelled: ["Отменено", "neutral"] } as const;
const CHANNEL = { pro: "Pro", promotion: "Продвижение", ads: "Реклама" } as const;

export default async function AdminBilling({ searchParams }: PageProps<"/admin/billing">) {
  const me = await pageAdmin();
  const p = await searchParams;
  const status = sp(p.status) ?? "requested";
  const page = Number(sp(p.page) ?? 1) || 1;
  const data = await adminInvoices({ status: status === "all" ? undefined : status, page });
  const channels = enabledChannels();
  const products = [...Object.keys(PLANS), ...Object.keys(PROMOTIONS)].map((id) => getProduct(id)!);
  return (
    <AdminPage
      title="Платные услуги"
      subtitle={
        <>
          Без эквайринга: исполнитель оставляет заявку, вы выставляете счёт вне платформы и подключаете услугу после оплаты. Каналы:{" "}
          {channels.length ? channels.map((c) => <Badge key={c} tone="accent">{CHANNEL[c]}</Badge>) : <Badge tone="neutral">все выключены — сервис полностью бесплатный</Badge>}
        </>
      }
    >
      {me.role === "admin" && (
        <section className="mb-5 rounded-[22px] bezel p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Подключить бесплатно (пробный период, партнёр, компенсация)</h2>
          <AdminForm
            type="billing.grant"
            fields={[
              { name: "slug", label: "Адрес профиля исполнителя", placeholder: "ivan-petrov-elektrik", required: true },
              { name: "productId", label: "Услуга", kind: "select", required: true, options: products.map((x) => ({ v: x.id, l: x.title })) },
            ]}
            submitLabel="Подключить"
          />
        </section>
      )}
      <Filters base="/admin/billing" status={status} statuses={[{ v: "requested", l: "Ждут оплаты" }, { v: "activated", l: "Подключены" }, { v: "cancelled", l: "Отменены" }, { v: "all", l: "Все" }]} />
      <Table head={["№", "Дата", "Исполнитель", "Услуга", "К оплате", "Статус", ""]} empty={!data.rows.length}>
        {data.rows.map(({ i, userName, email, providerName, providerSlug }) => {
          const s = STATUS[i.status];
          return (
            <tr key={i.id}>
              <td className="tabular">{i.number}</td>
              <td>{dateShort(i.createdAt)}</td>
              <td>
                <Link href={`/provider/${providerSlug}`} className="underline">
                  {providerName}
                </Link>
                <p className="text-[12px] text-muted">
                  {userName}
                  {email ? ` · ${email}` : ""}
                </p>
              </td>
              <td>{getProduct(i.productId)?.title ?? i.productId}</td>
              <td className="tabular">
                {rub(i.amount - i.discount)}
                {i.discount > 0 && <span className="text-[12px] text-muted"> (скидка {rub(i.discount)})</span>}
              </td>
              <td>
                <Badge tone={s[1]}>{s[0]}</Badge>
                {i.note && <p className="text-[12px] text-muted">{i.note}</p>}
              </td>
              <td>
                {i.status === "requested" && me.role === "admin" && (
                  <div className="flex gap-1.5">
                    <AdminAction payload={{ type: "invoice.activate", id: i.id }} label="Оплачено — подключить" variant="accent" confirmText="Оплата по счёту поступила? Услуга будет подключена." />
                    <AdminAction payload={{ type: "invoice.cancel", id: i.id }} label="Отменить" variant="ghost" prompt="Причина отмены" promptKey="note" />
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      <AdminPagination page={data.page} total={data.total} pageSize={data.pageSize} base="/admin/billing" params={{ status }} />
    </AdminPage>
  );
}
