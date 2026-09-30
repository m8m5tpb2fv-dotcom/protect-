"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Horizontal snap carousel. Touch-scroll on phones, arrow buttons on desktop. */
export function Rail({ children, itemClassName, className }: { children: ReactNode; itemClassName?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    on();
    el.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      el.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <div className={cn("group/rail relative", className)}>
      <div ref={ref} className="snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 pt-1 no-scrollbar lg:mx-0 lg:px-0">
        {Children.map(children, (c) => (
          <div className={cn("w-[78%] max-w-[320px] shrink-0 sm:w-[46%] lg:w-[calc((100%-36px)/4)] lg:max-w-none", itemClassName)}>{c}</div>
        ))}
      </div>
      <button onClick={() => by(-1)} disabled={edges.start} aria-label="Назад" className={cn("press glass absolute -left-5 top-[38%] hidden h-11 w-11 items-center justify-center rounded-full shadow-card transition-opacity lg:inline-flex", edges.start ? "pointer-events-none opacity-0" : "opacity-0 group-hover/rail:opacity-100")}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={() => by(1)} disabled={edges.end} aria-label="Вперёд" className={cn("press glass absolute -right-5 top-[38%] hidden h-11 w-11 items-center justify-center rounded-full shadow-card transition-opacity lg:inline-flex", edges.end ? "pointer-events-none opacity-0" : "opacity-0 group-hover/rail:opacity-100")}>
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
