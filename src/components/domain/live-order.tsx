import Link from "next/link";
import { ArrowUpRight, Hammer, Hourglass, MessageSquareText, UserCheck } from "lucide-react";
import type { OrderListItem } from "@/server/services/orders";
import { pl } from "@/lib/format";
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
export function LiveOrder({ order, docked }: { order: OrderListItem; docked?: boolean }) {
  const d = describe(order);
  const stage = STAGES.indexOf(order.status as (typeof STAGES)[number]);
  const pct = Math.max(12, ((stage + 1) / STAGES.length) * 100);
  return (
    <Link
      href={`/orders/${order.id}`}
      aria-label={`Заказ «${order.title}»: ${d.label}`}
      className={cn(
        "press group block rounded-[28px] border border-white/10 bg-[#0b0b0c] p-4 text-white shadow-[0_24px_50px_-20px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]",
        docked && "fixed inset-x-3 bottom-[calc(max(12px,var(--safe-bottom))+76px)] z-30 mx-auto max-w-[520px] lg:hidden",
      )}
    >
      {docked && <span aria-hidden className="mx-auto -mt-1.5 mb-2.5 block h-1 w-10 rounded-full bg-white/25" />}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-white/55">
            №{order.number} · {order.title}
          </p>
          <p className="mt-0.5 truncate text-[22px] font-light leading-tight tracking-[-0.035em]">
            {d.label}
            {d.sub && <span className="ml-2 text-[14px] font-normal tracking-normal text-white/50">{d.sub}</span>}
          </p>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/12 transition-transform group-hover:rotate-45">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
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
