"use client";
/* eslint-disable @next/next/no-img-element */
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; url: string; width: number; height: number; caption: string; kind: "image" | "video" };

/** Masonry portfolio with a keyboard/swipe-friendly lightbox. */
export function PortfolioGrid({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + items.length) % items.length)), [items.length]);
  useEffect(() => {
    if (open == null) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", on);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", on);
      document.documentElement.style.overflow = "";
    };
  }, [open, close, step]);
  const touchX = useRef(0);

  return (
    <>
      <div className="masonry columns-2 md:columns-3">
        {items.map((it, i) => (
          <button key={it.id} onClick={() => setOpen(i)} className="press group relative block w-full overflow-hidden rounded-[20px] bg-surface-2 text-left" style={{ aspectRatio: `${it.width} / ${it.height}` }} aria-label={it.caption || `Работа ${i + 1}`}>
            {it.kind === "video" ? (
              <>
                <video src={it.url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                <span className="glass absolute left-1/2 top-1/2 inline-flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
                  <Play className="h-5 w-5 fill-current" />
                </span>
              </>
            ) : (
              <img src={it.url} alt={it.caption} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            )}
            {it.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 pt-8 text-[12.5px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">{it.caption}</span>}
          </button>
        ))}
      </div>
      {open != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Портфолио"
          className="fixed inset-0 z-[95] flex flex-col bg-black/92 animate-fade"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between px-4 pt-[calc(var(--safe-top)+8px)] text-white">
            <span className="text-[14px] tabular opacity-70">
              {open + 1} / {items.length}
            </span>
            <button onClick={close} className="press inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label="Закрыть">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-4" onClick={close}>
            {items[open].kind === "video" ? (
              <video src={items[open].url} controls autoPlay playsInline className="max-h-full max-w-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={items[open].url} alt={items[open].caption} className="max-h-full max-w-full rounded-2xl object-contain animate-pop" onClick={(e) => e.stopPropagation()} />
            )}
            <button onClick={(e) => (e.stopPropagation(), step(-1))} className="press absolute left-4 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white md:inline-flex" aria-label="Предыдущая">
              <ChevronLeft />
            </button>
            <button onClick={(e) => (e.stopPropagation(), step(1))} className="press absolute right-4 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white md:inline-flex" aria-label="Следующая">
              <ChevronRight />
            </button>
          </div>
          {items[open].caption && <p className="px-6 pb-[calc(var(--safe-bottom)+16px)] text-center text-[15px] text-white/80">{items[open].caption}</p>}
        </div>
      )}
    </>
  );
}
