import Link from "next/link";
import { Crown } from "./crown";
import { Zap } from "lucide-react";
import type { ProviderCard as Card } from "@/server/services/providers";
import { cn } from "@/lib/cn";
import { km, pl, priceFrom, rub } from "@/lib/format";
import { Avatar } from "../ui/avatar";
import { StatusDot } from "../ui/badge";
import { buttonClass } from "../ui/button";
import { Media } from "../ui/media";
import { RatingInline } from "../ui/rating";
import { VerifiedMark } from "../ui/verified";
import { FavoriteButton } from "./favorite-button";
import { MessageButton } from "./message-button";

function cover(p: Card) {
  return p.coverUrl ?? `/art/${p.tone}/${p.icon}/${p.slug}-cover.svg?w=1600&h=900`;
}

function shortResponse(min: number | null) {
  if (min == null) return null;
  return min < 60 ? `~${min} мин` : `~${Math.round(min / 60)} ч`;
}

/** Vertical «creator» card — carousels & grids. */
export function ProviderCard({ p, favorite = false, className, actions, priority }: { p: Card; favorite?: boolean; className?: string; actions?: boolean; priority?: boolean }) {
  const chip = p.isPromoted ? "Реклама" : p.isHighlighted ? "Рекомендуем" : p.verification === "pro" ? "Профи" : p.verification === "business" ? "Проверенный бизнес" : p.experienceYears >= 5 ? `Опыт ${pl(p.experienceYears, ["год", "года", "лет"])}` : null;
  return (
    <article className={cn("group relative flex flex-col rounded-[30px] bezel p-1.5 lift", p.isHighlighted && "ring-2 ring-accent", className)}>
      {/* photo with overlaid identity (reference: surf coach card) */}
      <div className="relative overflow-hidden rounded-[25px]">
        <Media src={cover(p)} alt="" ratio={4 / 4.4} priority={priority} className="transition-transform duration-700 ease-[var(--ease-spring)] group-hover:scale-[1.03]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
        <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/40 px-3 text-[12.5px] font-semibold text-white backdrop-blur-md">
          <StatusDot online={p.isAvailable} />
          {p.isAvailable ? "Свободен" : "Занят"}
        </span>
        <FavoriteButton providerId={p.id} initial={favorite} className="absolute right-3 top-3 z-10 !bg-black/40 text-white !backdrop-blur-md !border-transparent" />
        <div className="absolute inset-x-3.5 bottom-3.5 text-white">
          {chip && <span className="mb-2 inline-flex h-6 items-center rounded-full bg-white/18 px-2.5 text-[11.5px] font-semibold backdrop-blur-md">{chip}</span>}
          <h3 className="flex items-center gap-1.5 text-[21px] font-semibold leading-tight tracking-[-0.03em]">
            <Link href={`/provider/${p.slug}`} className="truncate outline-none after:absolute after:inset-0 after:rounded-[30px] after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-ink">
              {p.displayName}
            </Link>
            <VerifiedMark level={p.verification} size={15} className="[&>span]:bg-white [&>span]:text-black" />
            <Crown show={p.hasCrown} size={17} />
          </h3>
          <p className="mt-0.5 truncate text-[13.5px] text-white/70">
            {p.subName}
            {p.districtName ? ` · ${p.districtName}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-2 text-[13.5px]">
          <RatingInline value={p.ratingAvg} count={p.reviewsCount} />
          <span className="text-line-strong">•</span>
          <span className="text-ink-2 tabular">{pl(p.ordersCompleted, ["заказ", "заказа", "заказов"])}</span>
          {p.responseTimeMin != null && (
            <span className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-muted" title={`Отвечает обычно за ${shortResponse(p.responseTimeMin)}`}>
              <Zap className="h-3.5 w-3.5" /> {shortResponse(p.responseTimeMin)}
            </span>
          )}
        </div>
        <div className="flex-1" />
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-[19px] font-light tracking-[-0.035em] tabular">{p.priceFrom != null ? <>от <b className="font-semibold">{rub(p.priceFrom)}</b></> : "По договорённости"}</span>
          {p.distanceKm != null && <span className="text-[13px] font-medium text-muted tabular">{km(p.distanceKm)}</span>}
        </div>
        {actions && (
          <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
            <MessageButton providerId={p.id} variant="outline" className="h-10" />
            <Link href={`/order/new?provider=${p.id}`} className={buttonClass({ variant: "primary", size: "sm", className: "h-10" })}>
              Заказать
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

/** Horizontal row — search results on phones, lists. */
export function ProviderRow({ p, favorite = false, className }: { p: Card; favorite?: boolean; className?: string }) {
  return (
    <article className={cn("relative flex gap-3.5 rounded-[26px] bezel p-2.5 pr-3", p.isHighlighted && "ring-2 ring-accent", className)}>
      <div className="relative w-[104px] shrink-0 sm:w-[132px]">
        <Media src={cover(p)} alt="" className="h-full min-h-[132px] rounded-[20px]" />
        <Avatar name={p.displayName} src={p.avatarUrl} size={40} ring className="absolute -bottom-1 -right-1 shadow-soft" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-[16px] font-semibold tracking-[-0.02em]">
              <Link href={`/provider/${p.slug}`} className="truncate after:absolute after:inset-0 after:rounded-[26px] after:content-['']">
                {p.displayName}
              </Link>
              <VerifiedMark level={p.verification} size={13} />
              <Crown show={p.hasCrown} size={14} />
            </h3>
            <p className="truncate text-[13.5px] text-muted">{p.subName}</p>
          </div>
          <FavoriteButton providerId={p.id} initial={favorite} variant="plain" className="relative z-10 -mr-1.5 -mt-1.5 shrink-0" />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <RatingInline value={p.ratingAvg} count={p.reviewsCount} size={13} />
          <span className="text-line-strong">•</span>
          <span className="text-ink-2 tabular">{pl(p.ordersCompleted, ["заказ", "заказа", "заказов"])}</span>
          {p.distanceKm != null && (
            <>
              <span className="text-line-strong">•</span>
              <span className="text-ink-2 tabular">{km(p.distanceKm)}</span>
            </>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
          <StatusDot online={p.isAvailable} />
          {p.isAvailable ? "Свободен сейчас" : "Занят"}
          {p.responseTimeMin != null && <span>· ответ {shortResponse(p.responseTimeMin)}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-[15px] font-semibold tabular">{priceFrom(p.priceFrom)}</span>
          <div className="relative z-10 flex gap-1.5">
            <MessageButton providerId={p.id} compact />
            <Link href={`/order/new?provider=${p.id}`} className={buttonClass({ variant: "primary", size: "sm" })}>
              Заказать
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProviderCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] bezel p-2">
      <div className="skeleton aspect-[4/3] rounded-[var(--radius-tile)]" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-5 w-2/3 rounded-lg" />
        <div className="skeleton h-4 w-1/2 rounded-lg" />
        <div className="skeleton h-4 w-3/4 rounded-lg" />
      </div>
    </div>
  );
}
