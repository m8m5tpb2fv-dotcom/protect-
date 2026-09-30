import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { pageProvider } from "@/server/auth/session";
import { db } from "@/server/db";
import { providers } from "@/server/db/schema";
import { anyChannelOn, offers, perks, providerInvoices } from "@/server/billing";
import { FREE_FOREVER, getProduct } from "@/config/monetization";
import { Badge } from "@/components/ui/badge";
import { dateShort, rub } from "@/lib/format";
import { CancelRequest, RequestService } from "./request";

export const metadata: Metadata = { title: "Продвижение", robots: { index: false } };

const STATUS = { requested: ["Ждёт оплаты по счёту", "warning"], activated: ["Подключено", "success"], cancelled: ["Отменено", "neutral"] } as const;

export default async function BillingPage() {
  const user = await pageProvider("/pro/billing");
  // With every paid channel switched off the section does not exist at all.
  if (!anyChannelOn()) notFound();
  const [[p], history] = await Promise.all([db.select().from(providers).where(eq(providers.id, user.provider.id)), providerInvoices(user.provider.id)]);
  const perk = perks(p);
  const open = new Set(history.filter((h) => h.status === "requested").map((h) => h.productId));
  const cards = offers().map((o) => {
    const until = o.kind === "subscription" ? p.proUntil : o.id.startsWith("highlight") ? p.highlightedUntil : p.boostedUntil;
    const active = o.kind === "subscription" ? perk.pro : o.id.startsWith("highlight") ? perk.highlighted : perk.boosted;
    return { ...o, active, until };
  });

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
        <p className="mt-3 text-[13.5px] text-muted">Услуги ниже — по желанию. Они не влияют на доступ к заявкам, чату и отзывам.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <section key={c.id} className="flex flex-col rounded-[28px] bezel p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{c.title}</h2>
              {c.active && <Badge tone="accent">Активно</Badge>}
            </div>
            <p className="mt-2 flex-1 text-[14px] text-muted">{c.description}</p>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] tabular">
              {rub(c.price)}
              {c.kind === "subscription" && <span className="text-[14px] font-medium text-muted"> / мес</span>}
            </p>
            {c.active && c.until && <p className="text-[13px] text-muted">до {dateShort(c.until)}</p>}
            <RequestService productId={c.id} title={c.title} label={c.active ? "Продлить" : "Подключить"} pending={open.has(c.id)} disabled={p.status !== "active"} />
          </section>
        ))}
      </div>

      <p className="rounded-[22px] bg-surface-2 p-4 text-[13.5px] text-muted">
        Оплата онлайн на платформе не принимается. После заявки мы пришлём счёт на email или в Telegram; услуга включится, как только оплата поступит.
      </p>

      <section>
        <h2 className="title mb-3 text-[20px]">Заявки</h2>
        {history.length === 0 ? (
          <p className="text-[14.5px] text-muted">Заявок пока не было.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[24px] bezel">
            {history.map((h) => {
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
                  <span className="font-semibold tabular">{rub(h.amount - h.discount)}</span>
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
