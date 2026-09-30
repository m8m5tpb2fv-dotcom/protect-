"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { addressSuggestEnabled, geocodeSuggestion, suggestAddress, type AddressSuggestion, type GeocodeResult, type GeoPoint } from "@/lib/yandex-geo";

/**
 * Address field with Yandex suggestions (combobox). Choosing a suggestion geocodes it and reports
 * the point via `onPick`, so the order gets real coordinates. Without a suggest key it is a plain input.
 */
export function AddressInput({ label, value, onChange, onPick, center, error }: { label: string; value: string; onChange: (v: string) => void; onPick: (r: GeocodeResult) => void; center: GeoPoint; error?: string | null }) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const listId = useId();
  const enabled = addressSuggestEnabled();
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || value === picked || value.trim().length < 3) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await suggestAddress(value, center, ctrl.signal);
        setItems(r);
        setActive(-1);
        setOpen(r.length > 0);
      } catch {
        /* network hiccup or aborted — keep typing without suggestions */
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [value, enabled, picked, center]);

  const choose = async (s: AddressSuggestion) => {
    setOpen(false);
    setPicked(s.title);
    onChange(s.title);
    const g = await geocodeSuggestion(s).catch(() => null);
    if (g) {
      const street = g.street || s.title;
      setPicked(street);
      onChange(street);
      onPick({ ...g, street });
    }
  };

  return (
    <div className="relative mt-4">
      <Input
        label={label}
        leading={<MapPin className="h-4 w-4" />}
        placeholder="Улица, дом"
        autoComplete="street-address"
        value={value}
        maxLength={180}
        error={error}
        role={enabled ? "combobox" : undefined}
        aria-expanded={enabled ? open : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-autocomplete={enabled ? "list" : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length && value !== picked && setOpen(true)}
        onBlur={() => (blurTimer.current = window.setTimeout(() => setOpen(false), 150))}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            void choose(items[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-[20px] bezel shadow-float animate-pop">
          {items.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void choose(s)}
              className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 text-left", i === active ? "bg-surface-2" : "hover:bg-surface-2", i > 0 && "border-t border-line")}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                {s.subtitle && <span className="block truncate text-[13px] text-muted">{s.subtitle}</span>}
              </span>
            </li>
          ))}
          <li aria-hidden className="border-t border-line px-4 py-1.5 text-right text-[11px] text-muted">Подсказки: Яндекс</li>
        </ul>
      )}
    </div>
  );
}
