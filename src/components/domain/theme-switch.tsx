"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useTelegram } from "../telegram/telegram-provider";

type Pref = "light" | "dark" | "system";

function applyTheme(p: Pref) {
  document.cookie = `ryadom_theme=${p}; path=/; max-age=31536000; samesite=lax`;
  const root = document.documentElement;
  root.dataset.themePref = p;
  root.dataset.theme = p === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : p;
}
const noopSubscribe = () => () => {};

export function ThemeSwitch() {
  const initial = useSyncExternalStore(noopSubscribe, () => (document.documentElement.dataset.themePref as Pref) || "dark", () => "dark" as Pref);
  const [chosen, setChosen] = useState<Pref | null>(null);
  const pref = chosen ?? initial;
  const { isTelegram } = useTelegram();
  if (isTelegram) return <p className="text-[14px] text-muted">Тема синхронизирована с Telegram.</p>;
  const apply = (p: Pref) => {
    setChosen(p);
    applyTheme(p);
  };
  const opts = [
    { v: "light" as const, l: "Светлая", i: Sun },
    { v: "dark" as const, l: "Тёмная", i: Moon },
    { v: "system" as const, l: "Системная", i: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Тема оформления">
      {opts.map((o) => (
        <button key={o.v} role="radio" aria-checked={pref === o.v} onClick={() => apply(o.v)} className={cn("press flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold", pref === o.v ? "bg-ink text-bg" : "bg-surface-2 hover:bg-surface-3")}>
          <o.i className="h-5 w-5" /> {o.l}
        </button>
      ))}
    </div>
  );
}
