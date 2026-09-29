"use client";
import { Check, LocateFixed, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Sheet } from "../ui/sheet";
import { Button, Spinner } from "../ui/button";
import { useToast } from "../ui/toast";
import { useTelegram } from "../telegram/telegram-provider";
import { getLocation } from "@/lib/geo-client";

const SORTS = [
  { v: "", l: "По умолчанию" },
  { v: "rating", l: "По рейтингу" },
  { v: "reviews", l: "По отзывам" },
  { v: "price", l: "Сначала дешевле" },
  { v: "distance", l: "Ближе ко мне" },
];

export function SearchFilters({ districts }: { districts: { slug: string; name: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const toast = useToast();
  const { webApp } = useTelegram();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const hasGeo = sp.has("lat");
  const locate = async () => {
    if (hasGeo) return set({ lat: null, lng: null, sort: sp.get("sort") === "distance" ? null : sp.get("sort") });
    setLocating(true);
    try {
      const pos = await getLocation(webApp);
      set({ lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5), sort: "distance" });
      toast("Показываем исполнителей рядом с вами", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLocating(false);
    }
  };

  const district = sp.get("district") ?? "";
  const active = [sp.get("available"), sp.get("verified"), district, sp.get("sort")].filter(Boolean).length;
  const chip = (on: boolean) => cn("press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold", on ? "bg-ink text-bg" : "bezel text-ink ring-1 ring-line hover:ring-line-strong");

  return (
    <div className={cn("-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 no-scrollbar lg:mx-0 lg:px-0", pending && "opacity-70")}>
      <button onClick={() => setOpen(true)} className={chip(active > 0)} aria-label="Фильтры">
        <SlidersHorizontal className="h-4 w-4" />
        Фильтры{active ? ` · ${active}` : ""}
      </button>
      <button onClick={locate} className={chip(hasGeo)} aria-pressed={hasGeo}>
        {locating ? <Spinner /> : <LocateFixed className="h-4 w-4" />} Рядом со мной
      </button>
      <button onClick={() => set({ available: sp.get("available") ? null : "1" })} className={chip(!!sp.get("available"))} aria-pressed={!!sp.get("available")}>
        <span className="h-2 w-2 rounded-full bg-success" /> Свободны сейчас
      </button>
      <button onClick={() => set({ verified: sp.get("verified") ? null : "1" })} className={chip(!!sp.get("verified"))} aria-pressed={!!sp.get("verified")}>
        Проверенные
      </button>
      {districts.map((d) => (
        <button key={d.slug} onClick={() => set({ district: district === d.slug ? null : d.slug })} className={chip(district === d.slug)} aria-pressed={district === d.slug}>
          {d.name}
        </button>
      ))}
      {pending && <Spinner className="ml-1 shrink-0" />}

      <Sheet open={open} onClose={() => setOpen(false)} title="Фильтры" footer={<Button block size="lg" onClick={() => setOpen(false)}>Показать</Button>}>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Сортировка</h3>
        <div className="mb-6 flex flex-col gap-1">
          {SORTS.map((s) => {
            const on = (sp.get("sort") ?? "") === s.v;
            return (
              <button key={s.v} disabled={s.v === "distance" && !hasGeo} onClick={() => set({ sort: s.v || null })} className={cn("flex min-h-12 items-center justify-between rounded-2xl px-4 text-left text-[15px] font-medium disabled:opacity-40", on ? "bg-accent-soft" : "hover:bg-surface-2")}>
                {s.l}
                {s.v === "distance" && !hasGeo && <span className="text-[12px] text-muted">нужна геолокация</span>}
                {on && <Check className="h-5 w-5" />}
              </button>
            );
          })}
        </div>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Район</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => set({ district: null })} className={chip(!district)}>
            Весь город
          </button>
          {districts.map((d) => (
            <button key={d.slug} onClick={() => set({ district: d.slug })} className={chip(district === d.slug)}>
              {d.name}
            </button>
          ))}
        </div>
        {active > 0 && (
          <button onClick={() => set({ available: null, verified: null, district: null, sort: null, lat: null, lng: null })} className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
            <X className="h-4 w-4" /> Сбросить всё
          </button>
        )}
      </Sheet>
    </div>
  );
}
