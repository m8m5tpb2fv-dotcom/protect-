"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronUp, Hammer, Hourglass, MessageSquareText, UserCheck } from "lucide-react";
import type { OrderListItem } from "@/server/services/orders";
import { pl, URGENCY } from "@/lib/format";
import { cn } from "@/lib/cn";

const STAGES = ["new", "responses", "assigned", "in_progress", "completed"] as const;

function describe(o: OrderListItem) {
  switch (o.status) {
    case "new":
      return { label: "Ищем исполнителя", sub: "Заявка разослана мастерам рядом", icon: Hourglass };
    case "responses":
      return { label: pl(o.responsesCount, ["отклик", "отклика", "откликов"]), sub: "Выберите исполнителя", icon: MessageSquareText };
    case "assigned":
      return { label: "Исполнитель выбран", sub: o.providerName ?? "", icon: UserCheck };
    default:
      return { label: "В работе", sub: o.providerName ?? "", icon: Hammer };
  }
}

/**
 * «Live activity» for the most relevant active order (references: Workouts timer card, flight progress).
 * Docked above the tab bar on phones, inline on desktop.
 */
const KEY = "ryadom_live_collapsed";

export function LiveOrder({ order, docked }: { order: OrderListItem; docked?: boolean }) {
  const stored = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(KEY) === order.id,
    () => false,
  );
  const [toggled, setToggled] = useState<boolean | null>(null);
  const collapsed = docked && (toggled ?? stored);
  const toggle = (v: boolean) => {
    setToggled(v);
    try {
      if (v) sessionStorage.setItem(KEY, order.id);
      else sessionStorage.removeItem(KEY);
    } catch {}
  };
  const d = describe(order);
  const stage = STAGES.indexOf(order.status as (typeof STAGES)[number]);
  const pct = Math.max(12, ((stage + 1) / STAGES.length) * 100);
  const price = order.agreedPrice ?? order.budget;
  const hot = order.urgency === "urgent" || order.urgency === "today";
  if (collapsed)
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        aria-label={`Развернуть: заказ «${order.title}», ${d.label}`}
        className="press fixed bottom-[calc(max(12px,var(--safe-bottom))+76px)] left-1/2 z-30 inline-flex h-11 -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/10 bg-[#0b0b0c] pl-3.5 pr-3 text-[13.5px] text-white shadow-[0_16px_36px_-14px_rgb(0_0_0/0.8)] lg:hidden"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#c8f050] shadow-[0_0_10px_#c8f050]" />
        <span className="max-w-[46vw] truncate font-medium">{d.label}</span>
        <span className="text-white/45 tabular">№{order.number}</span>
        <ChevronUp className="h-4 w-4 text-white/60" />
      </button>
    );
  return (
    <Link
      href={`/orders/${order.id}`}
      aria-label={`Заказ «${order.title}»: ${d.label}`}
      className={cn(
        "press group relative block overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0b0c] p-4 text-white shadow-[0_24px_50px_-20px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]",
        docked && "fixed inset-x-3 bottom-[calc(max(12px,var(--safe-bottom))+76px)] z-30 mx-auto max-w-[520px] lg:hidden",
      )}
    >
      {/* dot-matrix glow (reference: flight widget) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle,rgb(255_255_255/0.16)_1px,transparent_1.4px)] bg-[length:9px_9px] [mask-image:radial-gradient(ellipse_at_top_left,#000,transparent_60%)]" />
      <span aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-32 w-40 rounded-full bg-[#b7e34a]/15 blur-2xl" />
      {docked && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(true);
          }}
          aria-label="Свернуть виджет заказа"
          className="relative mx-auto -mt-3 mb-1 flex h-7 w-16 items-center justify-center"
        >
          <span className="block h-1 w-10 rounded-full bg-white/25" />
        </button>
      )}
      <div className="relative flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-white/55">
            №{order.number} · {order.title}
          </p>
          <p className="mt-1 truncate text-[23px] font-light leading-tight tracking-[-0.035em]">{d.label}</p>
          {d.sub && <p className="mt-0.5 truncate text-[13px] text-white/50">{d.sub}</p>}
        </div>
        <div className="flex w-[40%] max-w-[170px] shrink-0 flex-col justify-between rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="mono text-[17px] leading-tight tabular">{price != null ? `${price.toLocaleString("ru-RU")} ₽` : "цена?"}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-white/60 transition-transform group-hover:rotate-45" />
          </div>
          <span className={cn("mt-1 text-[11.5px] font-bold uppercase tracking-wide", hot ? "text-[#ff9f2e] [text-shadow:0_0_12px_rgb(255_159_46/0.5)]" : "text-white/45")}>{URGENCY[order.urgency].label}</span>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-3">
        <div className="relative h-9 flex-1 overflow-hidden rounded-full bg-white/[0.06] shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]">
          <div
            className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full bg-[linear-gradient(90deg,#b7e34a,#d9fb6a)] pr-3 shadow-[0_0_24px_rgb(200_245_80/0.55)]"
            style={{ width: `${pct}%` }}
          >
            <d.icon className="h-4 w-4 text-black" strokeWidth={2.2} />
          </div>
        </div>
        <span className="shrink-0 text-[12.5px] font-semibold text-white/45 tabular">
          этап {stage + 1}/{STAGES.length}
        </span>
      </div>
    </Link>
  );
}
