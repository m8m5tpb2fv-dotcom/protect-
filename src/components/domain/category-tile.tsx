import Link from "next/link";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { pl } from "@/lib/format";
import { toneStyle } from "@/lib/tones";
import { CatalogIcon } from "../ui/catalog-icon";

type Cat = { slug: string; name: string; icon: string; tone: string; description?: string };

/** Pastel tile with a large line icon. Dark mode uses the category's deep ink tone. */
export function CategoryTile({ c, count, size = "md", className }: { c: Cat; count?: number; size?: "md" | "lg"; className?: string }) {
  return (
    <Link
      href={`/services/${c.slug}`}
      style={toneStyle(c.tone)}
      className={cn(
        "press lift group relative flex overflow-hidden rounded-[var(--radius-card)] bg-[linear-gradient(145deg,var(--t-a),color-mix(in_srgb,var(--t-b)_55%,var(--t-a)))] text-[var(--t-ink)] dark:bg-[linear-gradient(145deg,color-mix(in_srgb,var(--t-ink)_70%,#000),color-mix(in_srgb,var(--t-c)_28%,#111))] dark:text-[var(--t-a)]",
        size === "lg" ? "min-h-[190px] flex-col justify-between p-5 md:min-h-[260px] md:p-6" : "min-h-[128px] flex-col justify-between p-4 md:min-h-[150px]",
        className,
      )}
    >
      <CatalogIcon
        name={c.icon}
        strokeWidth={1.1}
        className={cn("pointer-events-none absolute opacity-30 transition-transform duration-700 ease-[var(--ease-spring)] group-hover:rotate-[-6deg] group-hover:scale-110", size === "lg" ? "-bottom-6 -right-6 h-48 w-48" : "-bottom-4 -right-4 h-24 w-24")}
      />
      <span className={cn("inline-flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur dark:bg-white/10", size === "lg" ? "h-12 w-12" : "h-10 w-10")}>
        <CatalogIcon name={c.icon} className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
      </span>
      <span className="relative">
        <span className={cn("block font-semibold tracking-[-0.025em]", size === "lg" ? "text-[26px] leading-tight md:text-[30px]" : "text-[16px] leading-tight md:text-[17px]")}>{c.name}</span>
        {size === "lg" && c.description && <span className="mt-1 block max-w-[260px] text-[14px] opacity-75">{c.description}</span>}
        {count != null && count > 0 && <span className={cn("mt-1 block opacity-70 tabular", size === "lg" ? "text-[14px]" : "text-[12.5px]")}>{pl(count, ["специалист", "специалиста", "специалистов"])}</span>}
      </span>
      {size === "lg" && (
        <span className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/55 backdrop-blur transition-transform group-hover:rotate-45 dark:bg-white/10">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      )}
    </Link>
  );
}

export function AllServicesTile({ total, className }: { total: number; className?: string }) {
  return (
    <Link href="/services" className={cn("press lift flex min-h-[128px] flex-col justify-between rounded-[var(--radius-card)] bg-ink p-4 text-bg md:min-h-[150px]", className)}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-ink">
        <LayoutGrid className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-[16px] font-semibold tracking-[-0.025em] md:text-[17px]">Все услуги</span>
        <span className="mt-1 block text-[12.5px] opacity-65 tabular">{pl(total, ["исполнитель", "исполнителя", "исполнителей"])}</span>
      </span>
    </Link>
  );
}
