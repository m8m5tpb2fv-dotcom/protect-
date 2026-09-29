import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { pageProvider } from "@/server/auth/session";
import { db } from "@/server/db";
import { payments, providers } from "@/server/db/schema";
import { gateway } from "@/server/payments";
import { APP, PLANS, PROMOTIONS } from "@/config/app";
import { Badge } from "@/components/ui/badge";
import { dateShort, isFuture, rub } from "@/lib/format";
import { Checkout } from "./checkout";

export const metadata: Metadata = { title: "Продвижение и Pro", robots: { index: false } };

const STATUS = { pending: ["Ожидает", "warning"], succeeded: ["Оплачен", "success"], failed: ["Ошибка", "danger"], cancelled: ["Отменён", "neutral"], refunded: ["Возврат", "neutral"] } as const;

export default async function BillingPage({ searchParams }: PageProps<"/pro/billing">) {
  const user = await pageProvider();
  const sp = await searchParams;
  const [[p], history] = await Promise.all([db.select().from(providers).where(eq(providers.id, user.provider.id)), db.select().from(payments).where(eq(payments.providerId, user.provider.id)).orderBy(desc(payments.createdAt)).limit(30)]);
  const gw = gateway();
  const paid = typeof sp.paid === "string" ? history.find((h) => h.id === sp.paid) : null;
  const products = [
    { ...PLANS.pro_month, active: isFuture(p.proUntil), until: p.proUntil, kind: "plan" as const },
    ...Object.values(PROMOTIONS).map((x) => {
      const until = x.id.startsWith("highlight") ? p.highlightedUntil : p.boostedUntil;
      return { ...x, active: isFuture(until), until, kind: "promo" as const };
    }),
  ];
  return (
    <div className="flex flex-col gap-5">
      {gw.isTest && (
        <div className="rounded-[22px] border-2 border-dashed border-warning bg-warning-soft p-4 text-[14px] text-warning">
          <b>Тестовый режим оплаты.</b> Подключён sandbox-шлюз: реальные деньги не списываются, а оплата подтверждается на тестовой странице. Для приёма платежей настройте ЮKassa (PAYMENT_GATEWAY=yookassa).
        </div>
      )}
      {paid && (
        <div className={`rounded-[22px] p-4 text-[15px] font-semibold ${paid.status === "succeeded" ? "bg-accent text-accent-ink" : "bg-danger-soft text-danger"}`}>
          {paid.status === "succeeded" ? "Оплата прошла — услуга подключена." : paid.status === "pending" ? "Платёж обрабатывается. Статус обновится автоматически." : `Платёж не прошёл${paid.failureReason ? `: ${paid.failureReason}` : ""}.`}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {products.map((pr) => (
          <section key={pr.id} className={`flex flex-col rounded-[28px] p-5 ${pr.kind === "plan" ? "bg-ink text-bg md:col-span-2 xl:col-span-1" : "bezel"}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{pr.title}</h2>
              {pr.active && <Badge tone="accent">Активно</Badge>}
            </div>
            <p className={`mt-2 flex-1 text-[14px] ${pr.kind === "plan" ? "opacity-70" : "text-muted"}`}>{pr.description}</p>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] tabular">
              {rub(pr.price)}
              {pr.kind === "plan" && <span className="text-[14px] font-medium opacity-60"> / мес</span>}
            </p>
            {pr.active && pr.until && <p className={`text-[13px] ${pr.kind === "plan" ? "opacity-70" : "text-muted"}`}>до {dateShort(pr.until)}</p>}
            <Checkout productId={pr.id} label={pr.active ? "Продлить" : "Подключить"} disabled={p.status !== "active"} dark={pr.kind === "plan"} />
          </section>
        ))}
      </div>
      <section className="rounded-[28px] bezel p-5">
        <h2 className="title text-[20px]">Комиссия</h2>
        <p className="mt-1 text-[14.5px] text-muted">
          Платформа удерживает {Math.round(APP.commissionRate * 100)}% с выполненных заказов. Начислено к оплате: <b className="text-ink">{rub(Math.max(0, -p.balance))}</b>. Оплата комиссии будет доступна после подключения платёжного шлюза.
        </p>
      </section>
      <section>
        <h2 className="title mb-3 text-[20px]">История платежей</h2>
        {history.length === 0 ? (
          <p className="text-[14.5px] text-muted">Платежей пока не было.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[24px] bezel">
            {history.map((h) => {
              const s = STATUS[h.status];
              return (
                <li key={h.id} className="flex items-center gap-3 px-5 py-3.5 text-[14.5px]">
                  <span className="flex-1">
                    {PLANS[h.productId as keyof typeof PLANS]?.title ?? PROMOTIONS[h.productId as keyof typeof PROMOTIONS]?.title ?? h.productId}
                    <span className="block text-[12.5px] text-muted">
                      {dateShort(h.createdAt)} · {h.gateway}
                      {h.isTest && " · тест"}
                    </span>
                  </span>
                  <span className="font-semibold tabular">{rub(h.amount - h.discount)}</span>
                  <Badge tone={s[1]}>{s[0]}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
