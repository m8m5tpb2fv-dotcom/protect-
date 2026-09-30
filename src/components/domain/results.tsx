"use client";
import { List, Map as MapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ProviderCard as Card } from "@/server/services/providers";
import { cn } from "@/lib/cn";
import { MapView } from "../maps/map-view";
import { ProviderRow } from "./provider-card";

/** Results list + map. Desktop: split view with sticky map. Phone: list with a floating map toggle. */
export function ResultsWithMap({ items, favorites, center, me }: { items: Card[]; favorites: string[]; center: [number, number]; me?: { lat: number; lng: number } | null }) {
  const [view, setView] = useState<"list" | "map">("list");
  const [active, setActive] = useState<string | null>(null);
  const router = useRouter();
  const favs = useMemo(() => new Set(favorites), [favorites]);
  const markers = useMemo(
    () => [
      ...items.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.slug, lat: p.lat!, lng: p.lng!, label: p.priceFrom != null ? `${p.priceFrom.toLocaleString("ru-RU")} ₽` : p.displayName.split(" ")[0], title: p.displayName, active: active === p.slug, kind: "provider" as const })),
      ...(me ? [{ id: "me", lat: me.lat, lng: me.lng, kind: "me" as const }] : []),
    ],
    [items, active, me],
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-6">
      <ul className={cn("flex flex-col gap-3", view === "map" && "hidden lg:flex")}>
        {items.map((p) => (
          <li key={p.id} onMouseEnter={() => setActive(p.slug)} onMouseLeave={() => setActive(null)}>
            <ProviderRow p={p} favorite={favs.has(p.id)} />
          </li>
        ))}
      </ul>
      <div className={cn("lg:block", view === "map" ? "block" : "hidden")}>
        <MapView center={me ? [me.lat, me.lng] : center} zoom={12} markers={markers} fit={!me} onMarkerClick={(slug) => router.push(`/provider/${slug}`)} className="h-[calc(100dvh-260px)] min-h-[420px] lg:sticky lg:top-28 lg:h-[calc(100dvh-140px)]" />
      </div>
      <button
        onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
        className="press fixed bottom-[calc(var(--safe-bottom)+92px)] left-1/2 z-30 inline-flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-bg shadow-float lg:hidden"
      >
        {view === "list" ? <MapIcon className="h-[18px] w-[18px]" /> : <List className="h-[18px] w-[18px]" />}
        {view === "list" ? "На карте" : "Списком"}
      </button>
    </div>
  );
}
