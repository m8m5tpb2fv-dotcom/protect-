import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, MapPin, Phone, Wallet } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { getOrderDetail } from "@/server/services/orders";
import { listProviders } from "@/server/services/providers";
import { getCurrentCity } from "@/server/services/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Media } from "@/components/ui/media";
import { EmptyState } from "@/components/ui/empty";
import { Stars } from "@/components/ui/rating";
import { OrderStatusBadge } from "@/components/domain/order-card";
import { ProviderCard } from "@/components/domain/provider-card";
import { Rail } from "@/components/domain/rail";
import { ReportButton } from "@/components/domain/report-button";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { cn } from "@/lib/cn";
import { dateShort, pl, relative, rub, time, URGENCY } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { toneStyle } from "@/lib/tones";
import { ChatLink, OrderActions, RespondForm, ResponsesList, ReviewForm, type ResponseItem } from "./actions";
import { Hourglass } from "lucide-react";

export const metadata: Metadata = { title: "Заказ", robots: { index: false } };

const STEPS = [
  { key: "new", label: "Заявка" },
  { key: "responses", label: "Отклики" },
  { key: "assigned", label: "Выбран" },
  { key: "in_progress", label: "В работе" },
  { key: "completed", label: "Готово" },
];
const EVENT_LABEL: Record<string, string> = {
  created: "Заявка создана",
  response: "Новый отклик",
  assigned: "Исполнитель выбран",
  started: "Работа начата",
  completed: "Заказ завершён",
  cancelled: "Заказ отменён",
  declined: "Исполнитель отказался от прямого заказа",
  provider_withdrew: "Исполнитель отказался от заказа",
  reviewed: "Оставлен отзыв",
};

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let data: Awaited<ReturnType<typeof getOrderDetail>>;
  try {
    data = await getOrderDetail(id, user);
  } catch (e) {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const { order: o, role, sub, district, photos, events, responses, client, assigned, review, conversationId } = data;
  const isOpen = o.status === "new" || o.status === "responses";
  const stepIdx = o.status === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === o.status);
  const city = await getCurrentCity();
  const nearby = role === "client" && isOpen && responses.length < 3 ? await listProviders(city.id, { sort: "top", subIds: [o.subcategoryId], limit: 8, lat: o.lat ?? undefined, lng: o.lng ?? undefined }) : [];
  const myResponse = (role === "provider" || role === "prospect") && responses[0];
  const isAssignedToMe = !!user.provider && o.providerId === user.provider.id;
  const isDirectToMe = !!user.provider && o.directProviderId === user.provider.id;

  const details = (
    <section className="rounded-[28px] bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        {sub && (
          <span style={toneStyle(sub.tone)} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--t-a)] text-[var(--t-ink)] dark:bg-[color-mix(in_srgb,var(--t-ink)_70%,#000)] dark:text-[var(--t-a)]">
            <CatalogIcon name={sub.icon} className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-muted">
            {sub?.name} · №{o.number}
          </p>
          <h1 className="title mt-0.5 text-[24px] md:text-[28px]">{o.title}</h1>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <OrderStatusBadge status={o.status} />
      </div>
      {o.status !== "cancelled" && (
        <ol className="mt-5 grid grid-cols-5 gap-1.5" aria-label="Этапы заказа">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full", i <= stepIdx ? "bg-ink" : "bg-surface-3")} />
              <span className={cn("text-[11px] font-semibold", i <= stepIdx ? "text-ink" : "text-muted")}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-5 whitespace-pre-line text-[15.5px] leading-relaxed text-ink-2">{o.description}</p>
      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
              <Media src={p.url} alt="Фото к заказу" ratio={1} className="rounded-2xl" />
            </a>
          ))}
        </div>
      )}
      <dl className="mt-5 grid gap-3 border-t border-line pt-5 text-[14.5px] sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div>
            <dt className="sr-only">Адрес</dt>
            <dd>
              {o.address}
              {district && <span className="text-muted"> · {district.name} р-н</span>}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-muted" />
          <dd>
            {URGENCY[o.urgency].label} <span className="text-muted">— {URGENCY[o.urgency].hint}</span>
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Wallet className="h-4 w-4 text-muted" />
          <dd>{o.agreedPrice != null ? <>Цена: <b>{rub(o.agreedPrice)}</b></> : o.budget ? `Бюджет: ${rub(o.budget)}` : "Бюджет не указан"}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <CalendarDays className="h-4 w-4 text-muted" />
          <dd>
            {dateShort(o.createdAt)}, {time(o.createdAt)}
          </dd>
        </div>
      </dl>
      {o.cancelReason && <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-[14px] text-muted">Причина отмены: {o.cancelReason}</p>}
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-32 lg:px-6 lg:pt-6">
      <PageHeader title={`Заказ №${o.number}`} subtitle={relative(o.createdAt)} backHref={role === "client" ? "/orders" : "/pro"} />
      {sp.created === "1" && role === "client" && (
        <div className="mb-4 flex items-start gap-3 rounded-[24px] bg-accent p-4 text-accent-ink animate-pop">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-[16px] font-semibold">Заявка отправлена</p>
            <p className="text-[14px] opacity-80">{o.directProviderId ? "Исполнитель получил уведомление и скоро ответит." : "Подходящие исполнители рядом получили уведомление. Отклики появятся здесь — мы сообщим о каждом."}</p>
          </div>
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5">
          {details}

          {role === "client" && isOpen && (
            <section>
              <h2 className="title mb-3 text-[22px]">
                {responses.length ? pl(responses.length, ["отклик", "отклика", "откликов"]) : "Отклики"}
              </h2>
              {responses.length ? (
                <ResponsesList orderId={o.id} responses={responses as ResponseItem[]} canChoose />
              ) : (
                <EmptyState icon={Hourglass} title="Ждём откликов" text="Обычно первые исполнители откликаются в течение 10–15 минут. Мы пришлём уведомление." />
              )}
            </section>
          )}
          {role === "client" && !isOpen && responses.length > 1 && (
            <details className="rounded-[24px] bg-surface p-4 shadow-soft">
              <summary className="cursor-pointer text-[15px] font-semibold">Все отклики ({responses.length})</summary>
              <div className="mt-3">
                <ResponsesList orderId={o.id} responses={responses as ResponseItem[]} canChoose={false} />
              </div>
            </details>
          )}

          {nearby.length > 0 && (
            <section>
              <h2 className="title mb-1 text-[22px]">Подходящие исполнители</h2>
              <p className="mb-4 text-[14.5px] text-muted">Можно не ждать — напишите тому, кто понравился.</p>
              <Rail itemClassName="lg:w-[calc((100%-24px)/2)]">
                {nearby.map((p) => (
                  <ProviderCard key={p.id} p={p} actions />
                ))}
              </Rail>
            </section>
          )}

          <section className="rounded-[24px] bg-surface p-5 shadow-soft">
            <h2 className="mb-3 text-[15px] font-semibold">История</h2>
            <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative text-[14px]">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink" />
                  <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span className="ml-2 text-muted">
                    {dateShort(e.createdAt)}, {time(e.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="mt-5 flex flex-col gap-4 lg:mt-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-28">
            {role === "client" && assigned && (
              <section className="rounded-[28px] bg-surface p-5 shadow-card">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Исполнитель</p>
                <Link href={`/provider/${assigned.slug}`} className="mt-3 flex items-center gap-3">
                  <Avatar name={assigned.displayName} src={assigned.avatarUrl} size={52} />
                  <div>
                    <p className="text-[17px] font-semibold hover:underline">{assigned.displayName}</p>
                    <p className="text-[13px] text-muted">
                      ★ {assigned.ratingAvg.toFixed(1).replace(".", ",")} · {pl(assigned.reviewsCount, ["отзыв", "отзыва", "отзывов"])}
                    </p>
                  </div>
                </Link>
                {assigned.phone && (
                  <a href={`tel:${assigned.phone.replace(/[^\d+]/g, "")}`} className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-surface-2 px-4 text-[15px] font-semibold">
                    <Phone className="h-4 w-4" /> {formatPhone(assigned.phone) || assigned.phone}
                  </a>
                )}
                {conversationId && (
                  <div className="mt-2">
                    <ChatLink conversationId={conversationId} label="Чат с исполнителем" />
                  </div>
                )}
              </section>
            )}

            {(role === "provider" || role === "prospect") && (
              <section className="rounded-[28px] bg-surface p-5 shadow-card">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Клиент</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={client.name} src={client.avatarUrl} size={48} />
                  <div>
                    <p className="text-[16px] font-semibold">{client.name.split(" ")[0]}</p>
                    <p className="text-[13px] text-muted">{isAssignedToMe ? "Контакты открыты" : "Контакты откроются после выбора"}</p>
                  </div>
                </div>
                {client.phone && (
                  <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-surface-2 px-4 text-[15px] font-semibold">
                    <Phone className="h-4 w-4" /> {formatPhone(client.phone) || client.phone}
                  </a>
                )}
                {conversationId && (
                  <div className="mt-2">
                    <ChatLink conversationId={conversationId} label="Чат с клиентом" />
                  </div>
                )}
              </section>
            )}

            {role === "prospect" && !myResponse && isOpen && <RespondForm orderId={o.id} budget={o.budget} />}
            {myResponse && (
              <section className="rounded-[26px] bg-surface p-5 shadow-soft">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Ваш отклик</p>
                <p className="mt-2 text-[18px] font-semibold tabular">{myResponse.price != null ? rub(myResponse.price) : "Цена не указана"}</p>
                <p className="mt-1 whitespace-pre-line text-[14.5px] text-ink-2">{myResponse.message}</p>
                <p className="mt-2 text-[13px] text-muted">{myResponse.status === "accepted" ? "Клиент выбрал вас" : myResponse.status === "declined" ? "Клиент выбрал другого исполнителя" : myResponse.status === "withdrawn" ? "Вы отказались" : "Ожидает решения клиента"}</p>
              </section>
            )}

            <OrderActions orderId={o.id} role={role} status={o.status} isDirectToMe={isDirectToMe} isAssignedToMe={isAssignedToMe} agreedPrice={o.agreedPrice} />

            {role === "client" && o.status === "completed" && assigned && !review && <ReviewForm orderId={o.id} providerName={assigned.displayName} />}
            {review && (
              <section className="rounded-[26px] bg-surface p-5 shadow-soft">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Отзыв клиента</p>
                <Stars value={review.rating} className="mt-2" />
                {review.text && <p className="mt-2 text-[15px] text-ink-2">{review.text}</p>}
              </section>
            )}
            <div className="flex justify-center">
              <ReportButton targetType="order" targetId={o.id} label="Сообщить о проблеме" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
