"use client";
import { ArrowUpRight, CornerDownLeft, Search, Sparkles, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { CatalogIcon } from "../ui/catalog-icon";

type Suggest = {
  subs: { slug: string; name: string; categoryName: string; icon: string }[];
  services: { slug: string; name: string; subName: string; icon: string; priceFrom: number | null }[];
  providers: { slug: string; displayName: string; subName: string }[];
};

const EXAMPLES = ["Нужен электрик", "Уборка квартиры", "Ремонт iPhone", "Тренер по боксу", "Фотограф на свадьбу", "Переводчик", "Засор в ванной", "Грузчики на переезд"];

type Option = { key: string; label: string; hint?: string; icon: React.ReactNode; href: string };

export function SearchBox({ initial = "", autoFocus, size = "lg", className, onSubmitted }: { initial?: string; autoFocus?: boolean; size?: "lg" | "md"; className?: string; onSubmitted?: () => void }) {
  const [q, setQ] = useState(initial);
  const [data, setData] = useState<Suggest | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [ph, setPh] = useState(0);
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setPh((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<Suggest>(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((d) => {
          setData(d);
          setActive(-1);
        })
        .catch(() => {});
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useMemo<Option[]>(() => {
    if (!data) return [];
    const term = q.trim();
    return [
      ...data.services.map((s) => ({ key: `svc-${s.slug}`, label: s.name, hint: `${s.subName}${s.priceFrom ? ` · от ${s.priceFrom.toLocaleString("ru-RU")} ₽` : ""}`, icon: <CatalogIcon name={s.icon} className="h-[18px] w-[18px]" />, href: `/order/new?service=${s.slug}` })),
      ...data.subs.map((s) => ({ key: `sub-${s.slug}`, label: s.name, hint: s.categoryName, icon: <CatalogIcon name={s.icon} className="h-[18px] w-[18px]" />, href: `/services/${s.slug}` })),
      ...data.providers.map((p) => ({ key: `p-${p.slug}`, label: p.displayName, hint: p.subName, icon: <UserRound className="h-[18px] w-[18px]" />, href: `/provider/${p.slug}` })),
      { key: "all", label: `Все результаты по «${term}»`, icon: <Search className="h-[18px] w-[18px]" />, href: `/search?q=${encodeURIComponent(term)}` },
      { key: "order", label: `Создать заявку «${term}»`, hint: "Исполнители сами предложат цену", icon: <Sparkles className="h-[18px] w-[18px]" />, href: `/order/new?q=${encodeURIComponent(term)}` },
    ];
  }, [data, q]);

  const go = (href: string) => {
    setOpen(false);
    onSubmitted?.();
    router.push(href);
  };

  const submit = () => {
    if (active >= 0 && options[active]) return go(options[active].href);
    const term = q.trim();
    if (term) go(`/search?q=${encodeURIComponent(term)}`);
    else inputRef.current?.focus();
  };

  const showList = open && q.trim().length >= 2 && options.length > 0;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "group flex items-center gap-3 rounded-full bezel ring-1 ring-line transition-shadow focus-within:shadow-float focus-within:ring-2 focus-within:ring-ink",
          size === "lg" ? "h-[62px] pl-5 pr-2" : "h-[52px] pl-4 pr-1.5",
        )}
      >
        <Search className="h-[22px] w-[22px] shrink-0 text-ink" strokeWidth={2.1} aria-hidden />
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={q}
            autoFocus={autoFocus}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(-1, a - 1));
              } else if (e.key === "Escape") setOpen(false);
            }}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-label="Что вам нужно?"
            enterKeyHint="search"
            autoComplete="off"
            className={cn("w-full bg-transparent font-medium outline-none placeholder:text-transparent", size === "lg" ? "text-[17px]" : "text-[16px]")}
            placeholder="Что вам нужно?"
          />
          {!q && (
            <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-muted", size === "lg" ? "text-[17px]" : "text-[16px]")}>
              <span key={ph} className="animate-rise">
                {EXAMPLES[ph]}
              </span>
            </span>
          )}
        </div>
        {q && (
          <button type="button" onClick={() => (setQ(""), inputRef.current?.focus())} className="press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Очистить">
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="submit" className={cn("press inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-bg", size === "lg" ? "h-[48px] px-5 text-[15px]" : "h-[40px] px-4 text-[14px]")}>
          Найти
        </button>
      </form>

      {showList && (
        <ul id={listId} role="listbox" className="glass absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[60dvh] overflow-y-auto rounded-[24px] p-2 shadow-float animate-pop">
          {options.map((o, i) => (
            <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(o.href)}
                className={cn("flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left", active === i ? "bg-surface-2" : "")}
              >
                <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", o.key === "order" ? "bg-accent text-accent-ink" : "bg-surface-2")}>{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{o.label}</span>
                  {o.hint && <span className="block truncate text-[13px] text-muted">{o.hint}</span>}
                </span>
                {active === i ? <CornerDownLeft className="h-4 w-4 text-muted" /> : <ArrowUpRight className="h-4 w-4 text-muted/60" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
