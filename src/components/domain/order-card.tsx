import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import type { OrderListItem } from "@/server/services/orders";
import { cn } from "@/lib/cn";
import { ORDER_STATUS, pl, relative, rub, URGENCY } from "@/lib/format";
import { toneStyle } from "@/lib/tones";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { CatalogIcon } from "../ui/catalog-icon";

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? ORDER_STATUS.new;
  return (
    <Badge tone={s.tone === "accent" ? "accent" : s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function OrderCard({ o, href, extra, viewer = "client", clientName }: { o: Pick<OrderListItem, "id" | "number" | "title" | "status" | "subName" | "icon" | "tone" | "createdAt" | "responsesCount" | "providerName" | "providerAvatar" | "agreedPrice" | "budget" | "urgency" | "districtName" | "hasReview">; href?: string; extra?: React.ReactNode; viewer?: "client" | "provider"; clientName?: string | null }) {
  const needsReview = viewer === "client" && o.status === "completed" && !o.hasReview;
  const person = viewer === "provider" ? (clientName ? { name: clientName, avatar: null } : null) : o.providerName ? { name: o.providerName, avatar: o.providerAvatar } : null;
  return (
    <Link href={href ?? `/orders/${o.id}`} className="press lift group flex gap-4 rounded-[26px] bg-surface p-4 shadow-card">
      <span style={toneStyle(o.tone)} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--t-a)] text-[var(--t-ink)] dark:bg-[color-mix(in_srgb,var(--t-ink)_70%,#000)] dark:text-[var(--t-a)]">
        <CatalogIcon name={o.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold tracking-[-0.015em]">{o.title}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted">
              {o.subName} · №{o.number} · {relative(o.createdAt)}
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={o.status} />
          {(o.status === "new" || o.status === "responses") && o.responsesCount > 0 && <Badge tone="ink">{pl(o.responsesCount, ["отклик", "отклика", "откликов"])}</Badge>}
          {(o.status === "new" || o.status === "responses") && <Badge>{URGENCY[o.urgency].label}</Badge>}
          {needsReview && <Badge tone="warning">Оставьте отзыв</Badge>}
          {o.districtName && (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
              <MapPin className="h-3 w-3" />
              {o.districtName}
            </span>
          )}
        </div>
        {person && (
          <div className={cn("mt-3 flex items-center gap-2 border-t border-line pt-3 text-[13.5px]")}>
            <Avatar name={person.name} src={person.avatar} size={26} />
            <span className="flex-1 truncate font-medium">{viewer === "provider" ? `Клиент: ${person.name}` : person.name}</span>
            {o.agreedPrice != null && <span className="font-semibold tabular">{rub(o.agreedPrice)}</span>}
          </div>
        )}
        {extra}
      </div>
    </Link>
  );
}
