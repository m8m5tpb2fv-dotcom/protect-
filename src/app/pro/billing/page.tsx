import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { pageProvider } from "@/server/auth/session";
import { db } from "@/server/db";
import { providers } from "@/server/db/schema";
import { anyChannelOn, offers, perks, providerInvoices } from "@/server/billing";
import { FREE_FOREVER, PROMOTION_FREE_NOTE, STAR_PLANS, getProduct } from "@/config/monetization";
import { Badge } from "@/components/ui/badge";
import { dateShort, rub } from "@/lib/format";
import { CancelRequest, RequestService, StarsCheckout } from "./request";

export const metadata: Metadata = { title: "Продвижение", robots: { index: false } };

const STATUS = { requested: ["Ждёт оплаты по счёту", "warning"], activated: ["Подключено", "success"], cancelled: ["Отменено", "neutral"] } as const;

export default async function BillingPage() {
  const user = await pageProvider("/pro/billing");
  // With every paid channel switched off the section does not exist at all.
  if (!anyChannelOn()) notFound();
  const [[p], history] = await Promise.all([db.select().from(providers).where(eq(providers.id, user.provider.id)), providerInvoices(user.provider.id)]);
  const perk = perks(p);
  // an unpaid Stars invoice is just an abandoned checkout, not a request waiting for an admin
  const shown = history.filter((h) => !(h.currency === "XTR" && h.status === "requested"));
  const open = new Set(shown.filter((h) => h.status === "requested").map((h) => h.productId));
  const cards = offers().map((o) => {
    const stars = o.currency === "XTR";
    const until = stars ? p.promoUntil : o.kind === "subscription" ? p.proUntil : o.id.startsWith("highlight") ? p.highlightedUntil : p.boostedUntil;
    const active = stars ? perk.promo : o.kind === "subscription" ? perk.pro : o.id.startsWith("highlight") ? perk.highlighted : perk.boosted;
    return { ...o, active, until };
  });
  const price = (amount: number, currency: string) => (currency === "XTR" ? `${amount} ⭐` : rub(amount));

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[28px] bezel p-5">
        <h2 className="title text-[20px]">Всё основное — бесплатно</h2>
        <ul className="mt-3 grid gap-1.5 text-[14.5px] text-ink-2 sm:grid-cols-2">
          {FREE_FOREVER.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13.5px] text-muted">Услуги ниже — по желанию. Откликаться на заявки, общаться в чате и получать отзывы можно и без них.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <section key={c.id} className="flex flex-col rounded-[28px] bezel p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{c.title}</h2>
              {c.active && <Badge tone="accent">Активно</Badge>}
            </div>
            <p className="mt-2 text-[14px] text-muted">{c.description}</p>
            {c.id in STAR_PLANS ? (
              <div className="mt-3 flex-1">
                <p className="text-[13px] font-semibold text-ink">Что даёт покупка</p>
                <ul className="mt-1.5 grid gap-1.5 text-[14px] text-ink-2">
                  {STAR_PLANS[c.id as keyof typeof STAR_PLANS].features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[13px] text-muted">{PROMOTION_FREE_NOTE} Место в поиске и значки профиля от продвижения не зависят.</p>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] tabular">
              {price(c.price, c.currency)}
              {c.kind === "subscription" && <span className="text-[14px] font-medium text-muted"> / 30 дней</span>}
            </p>
            {c.active && c.until && <p className="text-[13px] text-muted">до {dateShort(c.until)}{c.currency === "XTR" ? " · продление добавит 30 дней" : ""}</p>}
            {c.currency === "XTR" ? (
              <StarsCheckout productId={c.id} label={c.active ? "Продлить за звёзды" : `Подключить за ${c.price} ⭐`} active={c.active} disabled={p.status !== "active"} />
            ) : (
              <RequestService productId={c.id} title={c.title} label={c.active ? "Продлить" : "Подключить"} pending={open.has(c.id)} disabled={p.status !== "active"} />
            )}
          </section>
        ))}
      </div>

      <p className="rounded-[22px] bg-surface-2 p-4 text-[13.5px] text-muted">
        «Продвижение» оплачивается звёздами Telegram и включается сразу после оплаты. Вопросы по оплате и возвраты — командой /paysupport в нашем боте. Деньги за работу клиенты по-прежнему платят вам напрямую, без комиссии.
      </p>

      <section>
        <h2 className="title mb-3 text-[20px]">Заявки</h2>
        {shown.length === 0 ? (
          <p className="text-[14.5px] text-muted">Заявок пока не было.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[24px] bezel">
            {shown.map((h) => {
              const s = STATUS[h.status];
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-[14.5px]">
                  <span className="min-w-0 flex-1">
                    {getProduct(h.productId)?.title ?? h.productId}
                    <span className="block text-[12.5px] text-muted">
                      № {h.number} · {dateShort(h.createdAt)}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular">{price(h.amount - h.discount, h.currency)}</span>
                  <Badge tone={s[1]}>{s[0]}</Badge>
                  {h.status === "requested" && <CancelRequest id={h.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
