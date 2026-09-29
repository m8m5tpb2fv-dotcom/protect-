"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTelegram } from "../telegram/telegram-provider";

function stepFor(v: number) {
  return v < 3000 ? 100 : v < 20000 ? 500 : 1000;
}

/**
 * Budget picker (reference: tip calculator): big monospace amount with −/+,
 * a tick ruler slider, preset pills and the typical market price.
 * value = "" means «no budget — providers will propose».
 */
export function BudgetDial({ value, onChange, typical }: { value: string; onChange: (v: string) => void; typical: number | null }) {
  const { haptic } = useTelegram();
  const base = typical && typical > 0 ? typical : 1000;
  const max = Math.max(base * 4, 5000);
  const n = value ? Number(value) : 0;
  const set = (v: number) => {
    const clamped = Math.max(0, Math.min(10_000_000, Math.round(v)));
    onChange(clamped ? String(clamped) : "");
    haptic("select");
  };
  const presets = [base, Math.round((base * 1.5) / 100) * 100, base * 2].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="rounded-[32px] border border-white/10 bg-[#0b0b0c] p-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_24px_50px_-24px_rgb(0_0_0/0.8)]">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => set(n - stepFor(n - 1))} disabled={!n} className="press inline-flex h-12 w-16 items-center justify-center rounded-full bg-white/[0.08] disabled:opacity-30" aria-label="Уменьшить бюджет">
          <Minus className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="mono text-[44px] leading-none tabular">{n ? n.toLocaleString("ru-RU") : "—"}</p>
          <p className="mt-1 text-[12.5px] text-white/45">{n ? "₽ · ваш бюджет" : "без бюджета"}</p>
        </div>
        <button type="button" onClick={() => set(n ? n + stepFor(n) : base)} className="press inline-flex h-12 w-16 items-center justify-center rounded-full bg-white/[0.08]" aria-label="Увеличить бюджет">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mt-4 h-10">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.28)_0_1px,transparent_1px_10px)] [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" />
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.5)_0_1.5px,transparent_1.5px_60px)] [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" />
        <input
          type="range"
          min={0}
          max={max}
          step={stepFor(n || base)}
          value={Math.min(n, max)}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="Бюджет"
          aria-valuetext={n ? `${n} рублей` : "без бюджета"}
          className="dial-range absolute inset-0 w-full"
        />
      </div>

      <div className="mt-3 flex gap-2" role="group" aria-label="Быстрый выбор бюджета">
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => set(p)} aria-pressed={n === p} className={cn("press mono h-11 flex-1 rounded-full text-[15px] tabular", n === p ? "bg-white/85 text-black ring-2 ring-white/25 ring-offset-2 ring-offset-[#0b0b0c]" : "bg-white/[0.08] text-white/90")}>
            {p >= 10000 ? `${Math.round(p / 1000)}k` : p.toLocaleString("ru-RU")}
          </button>
        ))}
        <button type="button" onClick={() => onChange("")} aria-pressed={!n} className={cn("press h-11 rounded-full px-4 text-[13px] font-semibold", !n ? "bg-white/85 text-black" : "bg-white/[0.08] text-white/80")}>
          Не знаю
        </button>
      </div>

      {typical ? (
        <div className="mt-3 flex items-center justify-between rounded-[20px] bg-white/[0.06] px-4 py-3 text-[14px]">
          <span className="text-white/55">Обычно стоит</span>
          <span className="mono text-[#34e39a] tabular">от {typical.toLocaleString("ru-RU")} ₽</span>
        </div>
      ) : null}
    </div>
  );
}
