"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Item = { value: string; label: string; count?: number; href?: string };

/** Pill tabs. When they don't fit, they scroll horizontally: the active tab is kept in view and the cut edge fades out. */
export function Segmented({ items, value, onChange, className, size = "md" }: { items: Item[]; value: string; onChange?: (v: string) => void; className?: string; size?: "sm" | "md" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    const active = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (active && el.scrollWidth > el.clientWidth) el.scrollTo({ left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [value, items.length]);

  const mask =
    edges.left && edges.right
      ? "[mask-image:linear-gradient(90deg,transparent,#000_28px,#000_calc(100%-28px),transparent)]"
      : edges.right
        ? "[mask-image:linear-gradient(90deg,#000_calc(100%-36px),transparent)]"
        : edges.left
          ? "[mask-image:linear-gradient(90deg,transparent,#000_36px)]"
          : "";

  return (
    <div ref={ref} role="tablist" className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1 no-scrollbar", mask, className)}>
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
