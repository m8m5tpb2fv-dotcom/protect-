import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, MapPin, Star, Trophy, Users } from "lucide-react";
import { eq } from "drizzle-orm";
import { pageProvider } from "@/server/auth/session";
import { db } from "@/server/db";
import { providers } from "@/server/db/schema";
import { providerFeed, providerOrders } from "@/server/services/orders";
import { OrderCard } from "@/components/domain/order-card";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { anyChannelOn, perks } from "@/server/billing";
import { km, pl, plural, relative, rating, rub, URGENCY } from "@/lib/format";
import { toneStyle } from "@/lib/tones";
import { AvailabilityToggle } from "./availability-toggle";

export const metadata: Metadata = { title: "Кабинет исполнителя", robots: { index: false } };

export default async function ProHome({ searchParams }: PageProps<"/pro">) {
  const user = await pageProvider();
  const sp = await searchParams;
  const [[p], feed, mine] = await Promise.all([db.select().from(providers).where(eq(providers.id, user.provider.id)), providerFeed(user.provider.id), providerOrders(user.provider.id)]);
  const active = mine.filter((o) => o.status === "assigned" || o.status === "in_progress");
  const completed = mine.filter((o) => o.status === "completed");
  const perk = perks(p);

  const stats = [
    { icon: Star, v: p.reviewsCount ? rating(p.ratingAvg) : "—", l: pl(p.reviewsCount, ["отзыв", "отзыва", "отзывов"]) },
    { icon: Trophy, v: p.ordersCompleted, l: "выполнено" },
    { icon: Clock3, v: p.responseTimeMin != null ? `${p.responseTimeMin} мин` : "—", l: "время ответа" },
    { icon: Users, v: p.clientsCount, l: plural(p.clientsCount, ["клиент", "клиента", "клиентов"]) },
  ];

  return (
    <div className="flex flex-col gap-5">
      {sp.welcome === "1" && (
        <div className="flex items-start gap-3 rounded-[24px] bg-accent p-4 text-accent-ink animate-pop">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-[16px] font-semibold">Профиль создан и отправлен на проверку</p>
            <p className="text-[14px] opacity-80">Пока идёт модерация, добавьте услуги с ценами и работы в портфолио — это увеличит число заказов.</p>
          </div>
        </div>
      )}
      {p.status === "pending" && (
        <div className="flex items-start gap-3 rounded-[24px] bg-warning-soft p-4 text-warning">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-[14.5px]">
            <b>Профиль на проверке.</b> Обычно до 24 часов. После одобрения вы появитесь в поиске и сможете откликаться на заявки.
          </p>
        </div>
      )}
      {p.status === "rejected" && (
        <div className="flex items-start gap-3 rounded-[24px] bg-danger-soft p-4 text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-[14.5px]">
            <b>Профиль требует доработки:</b> {p.moderationNote}.{" "}
            <Link href="/pro/profile" className="underline">
              Исправить
            </Link>
          </p>
        </div>
      )}
      {p.status === "suspended" && <div className="rounded-[24px] bg-danger-soft p-4 text-[14.5px] text-danger">Профиль приостановлен модератором. Напишите в поддержку.</div>}

      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-[28px] bezel p-5">
          <AvailabilityToggle initial={p.isAvailable} disabled={p.status !== "active"} />
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[13.5px]">
            <Badge tone="success">0% комиссии · оплата вам напрямую</Badge>
            {perk.pro && <Badge tone="accent">Pro до {p.proUntil!.toLocaleDateString("ru-RU")}</Badge>}
            {perk.boosted && <Badge tone="ink">Поднят в поиске</Badge>}
            {!perk.pro && !perk.boosted && anyChannelOn() && (
              <Link href="/pro/billing" className="ml-auto font-semibold underline">
                Продвижение
              </Link>
            )}
          </div>
        </section>
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.l} className={cn("bezel rounded-[24px] p-4", i === 0 && "glow")}>
              <s.icon className={cn("h-5 w-5", i === 0 ? "text-accent" : "text-muted")} />
              <p className="num mt-3 text-[30px]">{s.v}</p>
              <p className={cn("mt-1 text-[12.5px]", "text-muted")}>{s.l}</p>
            </div>
          ))}
        </section>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="title mb-3 text-[22px]">В работе</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((o) => (
              <OrderCard key={o.id} o={o} viewer="provider" clientName={o.clientName} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="title text-[22px]">Заявки рядом</h2>
          <span className="text-[14px] text-muted">{pl(feed.filter((f) => !f.responded).length, ["новая", "новые", "новых"])}</span>
        </div>
        {p.status !== "active" ? (
          <EmptyState icon={Inbox} title="Заявки появятся после модерации" text="Мы покажем здесь заказы по вашей специализации и району." />
        ) : feed.length === 0 ? (
          <EmptyState icon={Inbox} title="Новых заявок пока нет" text="Как только клиент рядом создаст заявку по вашей специализации, мы пришлём уведомление." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {feed.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className={cn("press lift flex h-full flex-col rounded-[26px] bezel p-4", o.isDirect && "ring-2 ring-accent")}>
                  <div className="flex items-start gap-3">
                    <span style={toneStyle(o.tone)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--t-a)] text-[var(--t-ink)] dark:bg-[color-mix(in_srgb,var(--t-ink)_70%,#000)] dark:text-[var(--t-a)]">
                      <CatalogIcon name={o.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold">{o.title}</p>
                      <p className="text-[13px] text-muted">
                        {o.subName} · {relative(o.createdAt)}
                      </p>
                    </div>
                    {o.budget ? <span className="text-[15px] font-semibold tabular">{rub(o.budget)}</span> : null}
                  </div>
                  <p className="mt-3 line-clamp-2 text-[14.5px] text-ink-2">{o.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    {o.isDirect && <Badge tone="accent">Лично вам</Badge>}
                    <Badge tone={o.urgency === "urgent" ? "danger" : o.urgency === "today" ? "warning" : "neutral"}>{URGENCY[o.urgency].label}</Badge>
                    {o.distanceKm != null && (
                      <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
                        <MapPin className="h-3 w-3" /> {km(o.distanceKm)}
                        {o.districtName ? ` · ${o.districtName}` : ""}
                      </span>
                    )}
                    <span className="ml-auto">{o.responded ? <Badge tone="success">Вы откликнулись</Badge> : <span className={buttonClass({ variant: "primary", size: "sm" })}>Откликнуться</span>}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <h2 className="title mb-3 text-[22px]">Выполненные</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {completed.slice(0, 6).map((o) => (
              <OrderCard key={o.id} o={o} viewer="provider" clientName={o.clientName} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
