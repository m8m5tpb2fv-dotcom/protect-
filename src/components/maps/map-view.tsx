"use client";
import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { cn } from "@/lib/cn";
import { clusterMarkers, parseClusterId } from "./cluster";
import { createMap, lastMapDiagnostics, type MapAdapter, type MapCircle, type MapDiagnostics, type MapMarker } from "./adapters";

/** Provider-agnostic map. Renders nothing heavy until visible. */
export function MapView({ center, zoom = 12, markers = [], circles = [], onMarkerClick, className, fit }: { center: [number, number]; zoom?: number; markers?: MapMarker[]; circles?: MapCircle[]; onMarkerClick?: (id: string) => void; className?: string; fit?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const adapter = useRef<MapAdapter | null>(null);
  const [state, setState] = useState<"idle" | "ready" | "error">("idle");
  const [diag, setDiag] = useState<MapDiagnostics | null>(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);
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
          const a = await createMap(node, {
            center,
            zoom,
            dark,
            onMarkerClick: (id) => {
              // a cluster bubble zooms in; a real marker goes to the page's handler
              const c = parseClusterId(id);
              if (c) adapter.current?.setCenter(c, Math.min(adapter.current.getZoom() + 2, 18));
              else clickRef.current?.(id);
            },
          });
          if (cancelled) return a.destroy();
          adapter.current = a;
          a.onZoom(setZoomLevel);
          setZoomLevel(a.getZoom());
          setState("ready");
          if (new URLSearchParams(window.location.search).has("mapdebug")) setDiag(lastMapDiagnostics);
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
    if (fit) adapter.current.fitTo(markers);
  }, [state, markers, fit]);

  useEffect(() => {
    if (state !== "ready" || !adapter.current) return;
    adapter.current.setData(clusterMarkers(markers, zoomLevel), circles);
  }, [state, markers, circles, zoomLevel]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-[var(--radius-card)] bg-surface-2", className)}>
      <div ref={el} className="absolute inset-0 z-0" role="region" aria-label="Карта" />
      {diag && (
        <p className="absolute inset-x-2 top-2 z-[1000] rounded-xl bg-black/80 p-2 font-mono text-[11px] leading-snug text-white">
          карта: {diag.requested} → {diag.used}
          {diag.reason ? ` · ${diag.reason}` : " · ok"}
        </p>
      )}
      {state !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
          <MapPinned className="h-7 w-7" strokeWidth={1.6} />
          <span className="text-[13px]">{state === "error" ? "Карта недоступна" : "Загружаем карту…"}</span>
        </div>
      )}
    </div>
  );
}
