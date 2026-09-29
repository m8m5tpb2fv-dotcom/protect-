import Link from "next/link";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { pl } from "@/lib/format";
import { toneStyle } from "@/lib/tones";
import { CatalogIcon } from "../ui/catalog-icon";
import { Folder, TabJoint } from "../ui/folder";

type Cat = { slug: string; name: string; icon: string; tone: string; description?: string };

/** Graphite folder tile (reference: Workouts). The category tone only tints the icon chip. */
export function CategoryTile({ c, count, className }: { c: Cat; count?: number; className?: string }) {
  return (
    <Link href={`/services/${c.slug}`} style={toneStyle(c.tone)} className={cn("press group block", className)} aria-label={`${c.name}${count ? `, ${count} специалистов` : ""}`}>
      <Folder bodyClassName="flex min-h-[132px] flex-col justify-between p-4 transition-colors group-hover:bg-surface-2 md:min-h-[150px]">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--t-c)_22%,transparent)] text-[var(--t-ink)] dark:text-[var(--t-b)]">
          <CatalogIcon name={c.icon} className="h-[18px] w-[18px]" />
        </span>
        <span>
          <span className="block text-[16.5px] font-semibold leading-tight tracking-[-0.02em]">{c.name}</span>
          <span className="mt-1 block text-[13px] text-muted tabular">{count ? pl(count, ["специалист", "специалиста", "специалистов"]) : "Скоро"}</span>
        </span>
      </Folder>
    </Link>
  );
}

/** Hero tile: grainy gradient artwork with a notched dark panel (reference: humbleteam «Your balance»). */
export function CategoryHero({ c, count, className }: { c: Cat; count?: number; className?: string }) {
  return (
    <Link href={`/services/${c.slug}`} className={cn("press lift group relative block overflow-hidden rounded-[28px] bg-surface", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/art/${c.tone}/${c.icon}/hero-${c.slug}.svg?w=1200&h=900`} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-spring)] group-hover:scale-[1.04]" />
      <div className="relative flex h-full min-h-[250px] flex-col justify-between md:min-h-[320px]">
        <div className="flex items-start justify-between p-5">
          <span className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[32px]">{c.name}</span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-transform group-hover:rotate-45">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </div>
        <div className="relative mx-1.5 mb-1.5 text-[#0e0e10]">
          <span className="absolute -top-[26px] left-1/2 h-[28px] -translate-x-1/2 rounded-t-[12px] bg-[#0e0e10] px-5 pt-1.5 text-[12.5px] font-semibold text-white/90 tabular">
            <TabJoint side="right" className="bottom-0 text-[#0e0e10]" />
            <TabJoint side="left" className="bottom-0 text-[#0e0e10]" />
            {count ? pl(count, ["специалист", "специалиста", "специалистов"]) : "Скоро"}
          </span>
          <div className="rounded-[22px] bg-[#0e0e10] px-5 pb-4 pt-4 text-white">
            <p className="text-[14px] leading-snug text-white/70">{c.description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AllServicesTile({ total, className }: { total: number; className?: string }) {
  return (
    <Link href="/services" className={cn("press group block", className)}>
      <Folder className="[--folder:var(--accent)]" bodyClassName="flex min-h-[132px] flex-col justify-between p-4 !text-accent-ink md:min-h-[150px]">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/10">
          <LayoutGrid className="h-[18px] w-[18px]" />
        </span>
        <span>
          <span className="block text-[16.5px] font-semibold leading-tight tracking-[-0.02em]">Все услуги</span>
          <span className="mt-1 block text-[13px] opacity-65 tabular">{pl(total, ["исполнитель", "исполнителя", "исполнителей"])}</span>
        </span>
      </Folder>
    </Link>
  );
}
