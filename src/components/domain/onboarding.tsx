"use client";
import { ArrowRight, BriefcaseBusiness, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { APP } from "@/config/app";
import { LogoMark } from "../layout/logo";
import { useSession } from "../layout/session-provider";

function remember() {
  document.cookie = `ryadom_onboarded=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** First-visit welcome. Two clear paths, skippable, never shown again. */
export function Onboarding() {
  // don't interrupt deep links (provider pages, orders…), only the entry points
  const eligible = useSyncExternalStore(
    () => () => {},
    () => ["/", "/services", "/search"].includes(window.location.pathname) && !document.cookie.includes("ryadom_onboarded=1"),
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const open = eligible && !dismissed;
  const router = useRouter();
  const { city } = useSession();
  if (!open) return null;
  const close = (to?: string) => {
    remember();
    setDismissed(true);
    if (to) router.push(to);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onb-title" className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-bg animate-fade">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full bg-accent opacity-60 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute -left-32 bottom-10 h-[300px] w-[300px] rounded-full bg-accent opacity-20 blur-[100px]" />
      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+16px)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.04em]">
            <LogoMark /> {APP.name}
          </span>
          <button onClick={() => close()} className="press h-11 rounded-full px-4 text-[15px] font-semibold text-muted hover:text-ink">
            Пропустить
          </button>
        </div>
        <div className="mt-auto pt-16">
          <span className="glass inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold">
            <MapPin className="h-4 w-4" /> {city.name}
          </span>
          <h1 id="onb-title" className="display mt-5 text-[46px] sm:text-[56px]">
            Услуги
            <br />
            рядом с вами
          </h1>
          <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-ink-2">Опишите задачу — специалисты {city.nameIn} сами предложат цену и время. Без звонков по объявлениям.</p>
        </div>
        <div className="mt-10 flex flex-col gap-3 animate-rise">
          <button onClick={() => close("/")} className="press lift group flex items-center gap-4 rounded-[26px] bg-ink p-5 text-left text-bg shadow-float">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink">
              <Search className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-[17px] font-semibold">Найти специалиста</span>
              <span className="block text-[14px] opacity-70">Сантехник, уборка, репетитор, фотограф…</span>
            </span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <button onClick={() => close("/become-provider")} className="press lift group flex items-center gap-4 rounded-[26px] bezel p-5 text-left">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2">
              <BriefcaseBusiness className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-[17px] font-semibold">Я оказываю услуги</span>
              <span className="block text-[14px] text-muted">Получайте заказы от клиентов рядом</span>
            </span>
            <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
