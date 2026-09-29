"use client";
import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { cn } from "@/lib/cn";
import { createMap, type MapAdapter, type MapCircle, type MapMarker } from "./adapters";

/** Provider-agnostic map. Renders nothing heavy until visible. */
export function MapView({ center, zoom = 12, markers = [], circles = [], onMarkerClick, className, fit }: { center: [number, number]; zoom?: number; markers?: MapMarker[]; circles?: MapCircle[]; onMarkerClick?: (id: string) => void; className?: string; fit?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const adapter = useRef<MapAdapter | null>(null);
  const [state, setState] = useState<"idle" | "ready" | "error">("idle");
  const clickRef = useRef(onMarkerClick);
  useEffect(() => {
    clickRef.current = onMarkerClick;
  });

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || adapter.current) return;
        io.disconnect();
        try {
          const dark = document.documentElement.dataset.theme === "dark";
          const a = await createMap(node, { center, zoom, dark, onMarkerClick: (id) => clickRef.current?.(id) });
          if (cancelled) return a.destroy();
          adapter.current = a;
          setState("ready");
        } catch {
          setState("error");
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(node);
    return () => {
      cancelled = true;
      io.disconnect();
      adapter.current?.destroy();
      adapter.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== "ready" || !adapter.current) return;
    adapter.current.setData(markers, circles);
    if (fit) adapter.current.fitTo(markers);
  }, [state, markers, circles, fit]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-[var(--radius-card)] bg-surface-2", className)}>
      <div ref={el} className="absolute inset-0 z-0" role="region" aria-label="Карта" />
      {state !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
          <MapPinned className="h-7 w-7" strokeWidth={1.6} />
          <span className="text-[13px]">{state === "error" ? "Карта недоступна" : "Загружаем карту…"}</span>
        </div>
      )}
    </div>
  );
}
