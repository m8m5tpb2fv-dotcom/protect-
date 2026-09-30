"use client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Sheet } from "../ui/sheet";
import { Skeleton } from "../ui/empty";
import { useSession } from "./session-provider";
import { cn } from "@/lib/cn";

type City = { slug: string; name: string; region: string; isActive: boolean };

export function CityPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { city } = useSession();
  const router = useRouter();
  const [cities, setCities] = useState<City[] | null>(null);
  useEffect(() => {
    if (open && !cities) api<{ cities: City[] }>("/api/cities").then((r) => setCities(r.cities)).catch(() => setCities([]));
  }, [open, cities]);

  const choose = async (slug: string) => {
    await api("/api/cities", { body: { slug } });
    onClose();
    router.refresh();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ваш город">
      <p className="mb-4 text-[15px] text-muted">Сейчас мы работаем в Саратове. Новые города — совсем скоро.</p>
      <ul className="flex flex-col gap-1.5">
        {!cities && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
        {cities?.map((c) => (
          <li key={c.slug}>
            <button
              disabled={!c.isActive}
              onClick={() => choose(c.slug)}
              className={cn("press flex min-h-14 w-full items-center justify-between rounded-2xl px-4 text-left", c.slug === city.slug ? "bg-accent-soft" : "hover:bg-surface-2", !c.isActive && "opacity-60")}
            >
              <span>
                <span className="block text-[15px] font-semibold">{c.name}</span>
                <span className="block text-[13px] text-muted">{c.region}</span>
              </span>
              {c.slug === city.slug ? <Check className="h-5 w-5" /> : !c.isActive ? <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-muted">скоро</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
