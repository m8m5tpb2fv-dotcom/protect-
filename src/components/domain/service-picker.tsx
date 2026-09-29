"use client";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { buttonClass } from "../ui/button";
import { useTelegram } from "../telegram/telegram-provider";

type Svc = { id: string; title: string; description: string; priceFrom: number; priceTo: number | null; unit: string; serviceSlug: string | null };

/** «Выберите тип занятия» — radio cards + a big pay-style CTA (reference: surf coach booking). */
export function ServicePicker({ providerId, services, popularId }: { providerId: string; services: Svc[]; popularId?: string }) {
  const [selected, setSelected] = useState(services[0]?.id);
  const { haptic } = useTelegram();
  const sel = services.find((s) => s.id === selected);
  const href = `/order/new?provider=${providerId}${sel?.serviceSlug ? `&service=${sel.serviceSlug}` : ""}`;
  return (
    <div className="shell rounded-[32px] p-2">
      <p className="px-3 pb-2 pt-2 text-center text-[14px] font-medium text-muted">Выберите услугу</p>
      <div role="radiogroup" aria-label="Услуги и цены" className="flex flex-col gap-2">
        {services.map((s) => {
          const on = s.id === selected;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => (setSelected(s.id), haptic("select"))}
              className={cn(
                "press relative flex min-h-[64px] items-center gap-3.5 rounded-[22px] border-2 px-4 py-3 text-left transition-colors",
                on ? "border-ink bg-surface" : "border-transparent bg-surface/60 hover:bg-surface",
              )}
            >
              {s.id === popularId && <span className="absolute -top-2.5 left-4 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-bg">Чаще заказывают</span>}
              <span className={cn("inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2", on ? "border-ink" : "border-line-strong")} aria-hidden>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium leading-snug">{s.title}</span>
                {s.description && <span className="block truncate text-[13px] text-muted">{s.description}</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[17px] font-light tracking-[-0.03em] tabular">
                  {s.priceTo ? `${s.priceFrom.toLocaleString("ru-RU")}–${s.priceTo.toLocaleString("ru-RU")}` : `от ${s.priceFrom.toLocaleString("ru-RU")}`} ₽
                </span>
                <span className="block text-[12px] text-muted">{s.unit}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Link href={href} className={buttonClass({ variant: "primary", size: "lg", block: true, className: "mt-3" })}>
        Заказать{sel ? ` · от ${sel.priceFrom.toLocaleString("ru-RU")} ₽` : ""}
      </Link>
      <p className="px-4 pb-2 pt-3 text-center text-[12.5px] text-muted">Итоговую цену исполнитель подтвердит в отклике. Оплата — после выполнения.</p>
    </div>
  );
}
