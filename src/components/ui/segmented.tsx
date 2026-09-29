"use client";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Item = { value: string; label: string; count?: number; href?: string };

export function Segmented({ items, value, onChange, className, size = "md" }: { items: Item[]; value: string; onChange?: (v: string) => void; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1 no-scrollbar", className)}>
      {items.map((it) => {
        const active = it.value === value;
        const cls = cn(
          "press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 font-semibold",
          size === "sm" ? "h-8 text-[13px]" : "h-10 text-[14px]",
          active ? "bezel text-ink" : "text-muted hover:text-ink",
        );
        const inner = (
          <>
            {it.label}
            {it.count ? <span className={cn("rounded-full px-1.5 text-[11px] tabular", active ? "bg-accent text-accent-ink" : "bg-surface-3 text-ink-2")}>{it.count}</span> : null}
          </>
        );
        return it.href ? (
          <Link key={it.value} href={it.href} role="tab" aria-selected={active} className={cls} scroll={false}>
            {inner}
          </Link>
        ) : (
          <button key={it.value} role="tab" aria-selected={active} className={cls} onClick={() => onChange?.(it.value)} type="button">
            {inner}
          </button>
        );
      })}
    </div>
  );
}
