import Link from "next/link";
import { pageAdmin } from "@/server/auth/session";
import { dashboardStats } from "@/server/services/admin";
import { AdminPage } from "@/components/admin/table";
import { ColumnChart, RankBars } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";
import { rub } from "@/lib/format";
import { cn } from "@/lib/cn";

export default async function AdminDashboard() {
  await pageAdmin();
  const s = await dashboardStats(30);
  const tiles = [
    { l: "Пользователи", v: s.users.total, d: `+${s.users.fresh} за 30 дней` },
    { l: "Исполнители", v: s.providers.total, d: `+${s.providers.fresh} · ${s.providers.available} свободны` },
    { l: "Заказы всего", v: s.orders.total, d: `${s.orders.period} за 30 дней` },
    { l: "Активные", v: s.orders.active, d: "новые, отклики, в работе" },
    { l: "Завершённые", v: s.orders.completed, d: `${s.orders.cancelled} отменено` },
    { l: "Объём заказов (GMV)", v: rub(s.money.gmv), d: `${rub(s.money.gmvPeriod)} за 30 дней · прямые расчёты, 0% комиссии` },
    { l: "Средний чек", v: rub(s.money.avgCheck), d: "завершённые заказы" },
    { l: "Конверсия в исполнителя", v: `${s.conversion.assignRate}%`, d: "заявки с выбранным исполнителем, 30 дн." },
    { l: "Конверсия в выполнение", v: `${s.conversion.completeRate}%`, d: "30 дней" },
    { l: "Время ответа", v: s.avgResponseMin != null ? `${s.avgResponseMin} мин` : "—", d: "среднее по исполнителям" },
    { l: "Выручка платформы", v: rub(s.platformRevenue), d: `${rub(s.platformRevenuePeriod)} за 30 дней · звёздами Telegram: ${s.platformRevenueStars.toLocaleString("ru-RU")} ⭐` },
  ];
  return (
    <AdminPage title="Обзор" subtitle="Ключевые метрики маркетплейса">
      {(s.providers.pending > 0 || s.openReports > 0 || s.openTickets > 0 || s.openInvoices > 0) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {s.providers.pending > 0 && (
            <Link href="/admin/providers?status=pending">
              <Badge tone="warning">{s.providers.pending} профилей на модерации</Badge>
            </Link>
          )}
          {s.openReports > 0 && (
            <Link href="/admin/reports">
              <Badge tone="danger">{s.openReports} открытых жалоб</Badge>
            </Link>
          )}
          {s.openInvoices > 0 && (
            <Link href="/admin/billing">
              <Badge tone="accent">{s.openInvoices} заявок на платные услуги</Badge>
            </Link>
          )}
          {s.openTickets > 0 && (
            <Link href="/admin/tickets?status=open">
              <Badge tone="info">{s.openTickets} обращений</Badge>
            </Link>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.l} className={cn("bezel rounded-[24px] p-4", i === 5 && "glow")}>
            <p className={cn("text-[12.5px] font-semibold", "text-muted")}>{t.l}</p>
            <p className="num mt-2 text-[32px]">{typeof t.v === "number" ? t.v.toLocaleString("ru-RU") : t.v}</p>
            <p className={cn("mt-1.5 text-[12px]", "text-muted")}>{t.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        <section className="rounded-[24px] bezel p-5">
          <h2 className="text-[15px] font-semibold">Новые заказы по дням</h2>
          <p className="mb-4 text-[12.5px] text-muted">Последние 30 дней</p>
          <ColumnChart label="Новые заказы по дням" data={s.series.map((d) => ({ day: d.day, value: d.orders }))} />
        </section>
        <section className="rounded-[24px] bezel p-5">
          <h2 className="text-[15px] font-semibold">GMV по дням</h2>
          <p className="mb-4 text-[12.5px] text-muted">Сумма завершённых заказов, ₽</p>
          <ColumnChart label="GMV по дням" data={s.series.map((d) => ({ day: d.day, value: d.gmv }))} unit="rub" />
        </section>
        <section className="rounded-[24px] bezel p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Популярные категории</h2>
          <RankBars rows={s.topCats} />
        </section>
        <section className="rounded-[24px] bezel p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Популярные районы</h2>
          <RankBars rows={s.topDistricts} />
        </section>
        <section className="rounded-[24px] bezel p-5 xl:col-span-2">
          <h2 className="text-[15px] font-semibold">Новые пользователи по дням</h2>
          <p className="mb-4 text-[12.5px] text-muted">Последние 30 дней</p>
          <ColumnChart label="Новые пользователи по дням" data={s.userSeries.map((d) => ({ day: d.day, value: d.users }))} />
        </section>
      </div>
    </AdminPage>
  );
}
