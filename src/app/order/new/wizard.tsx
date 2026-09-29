"use client";
/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, Camera, Check, ChevronRight, Clock, LocateFixed, MapPin, Pencil, Search, Sun, Timer, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, uploadFile } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { rub, URGENCY } from "@/lib/format";
import { getLocation, nearestDistrict } from "@/lib/geo-client";
import { Avatar } from "@/components/ui/avatar";
import { Button, Spinner } from "@/components/ui/button";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { Input, Textarea } from "@/components/ui/field";
import { RatingInline } from "@/components/ui/rating";
import { useToast } from "@/components/ui/toast";
import { useMainButton, useTelegram } from "@/components/telegram/telegram-provider";

export type WizardCatalog = {
  id: number;
  name: string;
  icon: string;
  tone: string;
  subs: { id: number; slug: string; name: string; icon: string; keywords: string; services: { id: number; slug: string; name: string; priceFrom: number | null; unit: string | null }[] }[];
}[];

type Urgency = keyof typeof URGENCY;
type Draft = {
  subId: number | null;
  serviceId: number | null;
  title: string;
  description: string;
  photos: string[];
  address: string;
  districtId: number | null;
  lat: number | null;
  lng: number | null;
  urgency: Urgency | null;
  budget: string;
  contactPhone: string;
};

const STEPS = ["what", "task", "details", "where", "when", "review"] as const;
type Step = (typeof STEPS)[number];
const DRAFT_KEY = "ryadom_order_draft";
const URGENCY_ICON = { urgent: Zap, today: Sun, week: Clock, flexible: Timer } as const;

export function OrderWizard({
  catalog,
  districts,
  cityName,
  isAuthed,
  userPhone,
  initial,
  provider,
  resume,
}: {
  catalog: WizardCatalog;
  districts: { id: number; name: string; lat: number; lng: number }[];
  cityName: string;
  isAuthed: boolean;
  userPhone: string | null;
  initial: { subId: number | null; serviceId: number | null; q: string; urgency: Urgency | null; districtId: number | null };
  provider: { id: string; slug: string; displayName: string; avatarUrl: string | null; subName: string; ratingAvg: number; reviewsCount: number; prices: { serviceId: number | null; title: string; priceFrom: number }[] } | null;
  resume: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { haptic, webApp } = useTelegram();
  const allSubs = useMemo(() => catalog.flatMap((c) => c.subs.map((s) => ({ ...s, category: c.name }))), [catalog]);
  const svcById = useMemo(() => new Map(allSubs.flatMap((s) => s.services.map((v) => [v.id, v] as const))), [allSubs]);

  const [d, setD] = useState<Draft>(() => {
    const svc = initial.serviceId ? svcById.get(initial.serviceId) : null;
    return {
      subId: initial.subId,
      serviceId: initial.serviceId,
      title: svc?.name ?? (initial.q ? initial.q.charAt(0).toUpperCase() + initial.q.slice(1) : ""),
      description: "",
      photos: [],
      address: "",
      districtId: initial.districtId,
      lat: null,
      lng: null,
      urgency: initial.urgency,
      budget: "",
      contactPhone: userPhone ?? "",
    };
  });
  const firstStep: Step = d.subId ? (d.serviceId ? "details" : "task") : "what";
  const [step, setStep] = useState<Step>(firstStep);
  const [history, setHistory] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subQuery, setSubQuery] = useState(initial.q);
  const [uploading, setUploading] = useState(0);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // restore draft after login redirect
  useEffect(() => {
    if (!resume) return;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { draft: Draft };
        // sessionStorage exists only in the browser, so the draft can be restored only after hydration
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setD(parsed.draft);
        setStep("review");
      }
    } catch {}
  }, [resume]);

  const sub = allSubs.find((s) => s.id === d.subId) ?? null;
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const go = (s: Step) => {
    setHistory((h) => [...h, step]);
    setStep(s);
    setErrors({});
    haptic("select");
    topRef.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    if (!history.length) return router.back();
    setStep(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const validate = (s: Step): boolean => {
    const e: Record<string, string> = {};
    if (s === "task" && d.title.trim().length < 3) e.title = "Коротко назовите задачу";
    if (s === "details" && d.description.trim().length < 10) e.description = "Опишите задачу подробнее — хотя бы пару предложений";
    if (s === "where" && d.address.trim().length < 3) e.address = "Укажите адрес или ориентир";
    if (s === "when" && !d.urgency) e.urgency = "Выберите, когда нужна помощь";
    setErrors(e);
    if (Object.keys(e).length) haptic("error");
    return !Object.keys(e).length;
  };

  const nextOf: Record<Step, Step | null> = { what: "task", task: "details", details: "where", where: "when", when: "review", review: null };
  const next = () => {
    if (!validate(step)) return;
    const n = nextOf[step];
    if (n) go(n);
    else submit();
  };

  const submit = async () => {
    if (!isAuthed) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: d }));
      router.push(`/login?next=${encodeURIComponent("/order/new?resume=1" + (provider ? `&provider=${provider.id}` : ""))}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/orders", {
        body: {
          subcategoryId: d.subId,
          serviceId: d.serviceId,
          title: d.title,
          description: d.description,
          address: `${cityName}, ${d.address}`,
          districtId: d.districtId,
          lat: d.lat,
          lng: d.lng,
          urgency: d.urgency,
          budget: d.budget ? Number(d.budget.replace(/\D/g, "")) : null,
          contactPhone: d.contactPhone || null,
          photos: d.photos,
          directProviderId: provider?.id ?? null,
        },
      });
      sessionStorage.removeItem(DRAFT_KEY);
      haptic("success");
      router.replace(`/orders/${r.id}?created=1`);
      router.refresh();
    } catch (e) {
      haptic("error");
      if (e instanceof ApiError && Array.isArray(e.details)) setErrors(Object.fromEntries((e.details as { path: string; message: string }[]).map((x) => [x.path, x.message])));
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = [...files].slice(0, 8 - d.photos.length);
    for (const f of list) {
      setUploading((n) => n + 1);
      try {
        const r = await uploadFile(f, "order");
        setD((x) => ({ ...x, photos: [...x.photos, r.url] }));
      } catch (e) {
        toast(e instanceof ApiError && e.status === 401 ? "Войдите, чтобы прикрепить фото" : (e as Error).message, "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await getLocation(webApp);
      const near = nearestDistrict(pos, districts);
      set({ lat: pos.lat, lng: pos.lng, districtId: near?.id ?? d.districtId, address: d.address || "Моё местоположение" });
      toast(near ? `Определили район: ${near.name}` : "Местоположение определено", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLocating(false);
    }
  };

  const idx = STEPS.indexOf(step);
  const progress = ((idx + 1) / STEPS.length) * 100;
  const cta = step === "review" ? (isAuthed ? "Отправить заявку" : "Войти и отправить") : step === "what" ? "" : "Далее";
  const nativeButton = useMainButton({ text: cta || "Далее", onClick: next, loading: busy, visible: step !== "what" && step !== "task" });

  const filteredSubs = useMemo(() => {
    const q = subQuery.trim().toLowerCase().replace(/ё/g, "е");
    if (!q) return null;
    return allSubs.filter((s) => (s.name + " " + s.keywords + " " + s.services.map((v) => v.name).join(" ")).toLowerCase().replace(/ё/g, "е").includes(q.split(" ").filter((t) => t.length > 2)[0] ?? q)).slice(0, 12);
  }, [subQuery, allSubs]);

  const providerPrice = (serviceId: number) => provider?.prices.find((p) => p.serviceId === serviceId)?.priceFrom;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-40 lg:pb-16 lg:pt-8">
      <div ref={topRef} className="sticky top-0 z-30 -mx-4 bg-bg/90 px-4 pb-3 pt-[calc(var(--safe-top)+8px)] backdrop-blur-xl lg:static lg:mx-0 lg:bg-transparent lg:px-0">
        <div className="flex h-11 items-center gap-2">
          {!webApp && (
            <button onClick={back} className="press -ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Назад">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <span className="flex-1 text-[15px] font-semibold">Новая заявка</span>
          <span className="text-[13px] font-semibold text-muted tabular">
            {idx + 1} / {STEPS.length}
          </span>
          <Link href="/" className="press -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </Link>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-[var(--ease-spring)]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {provider && (
        <div className="mt-2 flex items-center gap-3 rounded-[22px] bg-surface p-3 shadow-soft">
          <Avatar name={provider.displayName} src={provider.avatarUrl} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-muted">Заявка напрямую исполнителю</p>
            <p className="truncate text-[15px] font-semibold">{provider.displayName}</p>
          </div>
          <RatingInline value={provider.ratingAvg} count={provider.reviewsCount} className="text-[13px]" />
        </div>
      )}

      <div key={step} className="mt-4 animate-rise">
        {step === "what" && (
          <section>
            <h1 className="display text-[34px] md:text-[44px]">Что нужно сделать?</h1>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
                autoFocus
                placeholder="Например: сантехник, уборка, репетитор"
                aria-label="Поиск услуги"
                className="h-14 w-full rounded-[20px] bg-surface pl-12 pr-4 text-[16px] shadow-card outline-none ring-1 ring-line focus:ring-2 focus:ring-ink"
              />
            </div>
            {filteredSubs ? (
              <ul className="mt-4 flex flex-col gap-2">
                {filteredSubs.length === 0 && <li className="rounded-2xl bg-surface p-4 text-[15px] text-muted">Ничего не нашли. Выберите категорию ниже.</li>}
                {filteredSubs.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => (set({ subId: s.id, serviceId: null }), go("task"))} className="press flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-surface px-4 text-left shadow-soft hover:shadow-card">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
                        <CatalogIcon name={s.icon} className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[15px] font-semibold">{s.name}</span>
                        <span className="block text-[13px] text-muted">{s.category}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 flex flex-col gap-6">
                {catalog.map((c) => (
                  <div key={c.id}>
                    <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                      <CatalogIcon name={c.icon} className="h-4 w-4" /> {c.name}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {c.subs.map((s) => (
                        <button key={s.id} onClick={() => (set({ subId: s.id, serviceId: null }), go("task"))} className="press inline-flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-[14.5px] font-medium shadow-soft ring-1 ring-line hover:ring-line-strong">
                          <CatalogIcon name={s.icon} className="h-4 w-4 text-ink-2" />
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {step === "task" && sub && (
          <section>
            <button onClick={() => go("what")} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold">
              <CatalogIcon name={sub.icon} className="h-4 w-4" /> {sub.name} <Pencil className="h-3 w-3 text-muted" />
            </button>
            <h1 className="display text-[34px] md:text-[44px]">Какая задача?</h1>
            <div className="mt-5 flex flex-col gap-2">
              {sub.services.map((v) => {
                const on = d.serviceId === v.id;
                const price = providerPrice(v.id) ?? v.priceFrom;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      set({ serviceId: v.id, title: v.name });
                      setTimeout(() => go("details"), 120);
                    }}
                    className={cn("press flex min-h-[60px] items-center gap-3 rounded-[20px] px-4 text-left", on ? "bg-ink text-bg" : "bg-surface shadow-soft hover:shadow-card")}
                  >
                    <span className="flex-1">
                      <span className="block text-[15.5px] font-semibold">{v.name}</span>
                      {price != null && (
                        <span className={cn("block text-[13px]", on ? "opacity-70" : "text-muted")}>
                          от {rub(price)} {v.unit}
                        </span>
                      )}
                    </span>
                    {on ? <Check className="h-5 w-5" /> : <ChevronRight className="h-5 w-5 text-muted" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-[22px] bg-surface p-4 shadow-soft">
              <Input label="Другое — опишите одной фразой" placeholder="Например: заменить радиатор" value={d.serviceId ? "" : d.title} onChange={(e) => set({ title: e.target.value, serviceId: null })} error={errors.title} maxLength={120} />
              <Button className="mt-3" block onClick={() => (d.title.trim().length >= 3 ? go("details") : setErrors({ title: "Коротко назовите задачу" }))}>
                Продолжить
              </Button>
            </div>
          </section>
        )}

        {step === "details" && (
          <section>
            <p className="mb-2 text-[14px] font-semibold text-muted">{d.title}</p>
            <h1 className="display text-[34px] md:text-[44px]">Опишите задачу</h1>
            <p className="mt-2 text-[15px] text-muted">Чем подробнее — тем точнее исполнители назовут цену.</p>
            <Textarea
              className="mt-5"
              rows={6}
              autoFocus
              placeholder="Например: протекает труба под раковиной на кухне, капает с соединения. Воду перекрыли."
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
              error={errors.description}
              maxLength={3000}
              hint={`${d.description.length} / 3000`}
            />
            <div className="mt-5">
              <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">
                Фото <span className="font-normal text-muted">· необязательно, до 8</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {d.photos.map((ph) => (
                  <div key={ph} className="relative h-24 w-24 overflow-hidden rounded-2xl bg-surface-2">
                    <img src={ph} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => set({ photos: d.photos.filter((p) => p !== ph) })} className="glass absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full" aria-label="Удалить фото">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, i) => (
                  <div key={i} className="skeleton flex h-24 w-24 items-center justify-center rounded-2xl">
                    <Spinner />
                  </div>
                ))}
                {d.photos.length + uploading < 8 && (
                  <button onClick={() => (isAuthed ? fileRef.current?.click() : toast("Войдите, чтобы прикрепить фото", "info"))} className="press flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line-strong text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">
                    <Camera className="h-5 w-5" /> Добавить
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
            </div>
          </section>
        )}

        {step === "where" && (
          <section>
            <h1 className="display text-[34px] md:text-[44px]">Где?</h1>
            <p className="mt-2 text-[15px] text-muted">Точный адрес увидит только выбранный исполнитель.</p>
            <button onClick={locate} disabled={locating} className="press mt-5 flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-surface px-4 text-left shadow-soft hover:shadow-card">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-info-soft text-info">{locating ? <Spinner /> : <LocateFixed className="h-5 w-5" />}</span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{d.lat ? "Местоположение определено" : "Использовать моё местоположение"}</span>
                <span className="block text-[13px] text-muted">{d.lat ? `${d.lat.toFixed(4)}, ${d.lng?.toFixed(4)}` : "Необязательно — можно указать адрес вручную"}</span>
              </span>
              {d.lat && <Check className="h-5 w-5 text-success" />}
            </button>
            <Input className="mt-4" label={`Адрес · ${cityName}`} leading={<MapPin className="h-4 w-4" />} placeholder="Улица, дом" autoComplete="street-address" value={d.address} onChange={(e) => set({ address: e.target.value })} error={errors.address} maxLength={180} />
            <p className="mb-2 mt-5 px-1 text-[13px] font-semibold text-ink-2">Район</p>
            <div className="flex flex-wrap gap-2">
              {districts.map((x) => (
                <button key={x.id} onClick={() => set({ districtId: d.districtId === x.id ? null : x.id })} className={cn("press h-11 rounded-full px-4 text-[14.5px] font-semibold", d.districtId === x.id ? "bg-ink text-bg" : "bg-surface shadow-soft ring-1 ring-line")} aria-pressed={d.districtId === x.id}>
                  {x.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "when" && (
          <section>
            <h1 className="display text-[34px] md:text-[44px]">Когда?</h1>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {(Object.keys(URGENCY) as Urgency[]).map((u) => {
                const Icon = URGENCY_ICON[u];
                const on = d.urgency === u;
                return (
                  <button key={u} onClick={() => (set({ urgency: u }), haptic("select"))} aria-pressed={on} className={cn("press flex min-h-[120px] flex-col justify-between rounded-[24px] p-4 text-left", on ? "bg-ink text-bg shadow-float" : "bg-surface shadow-soft hover:shadow-card")}>
                    <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", on ? "bg-accent text-accent-ink" : "bg-surface-2")}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[16px] font-semibold">{URGENCY[u].label}</span>
                      <span className={cn("block text-[13px]", on ? "opacity-70" : "text-muted")}>{URGENCY[u].hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.urgency && <p className="mt-2 px-1 text-[13px] text-danger">{errors.urgency}</p>}
            <Input className="mt-5" label="Бюджет, ₽" optional inputMode="numeric" placeholder="Например, 1500" value={d.budget} onChange={(e) => set({ budget: e.target.value.replace(/[^\d]/g, "").slice(0, 8) })} hint="Можно оставить пустым — исполнители предложат цену" />
          </section>
        )}

        {step === "review" && (
          <section>
            <h1 className="display text-[34px] md:text-[44px]">Проверьте заявку</h1>
            <dl className="mt-5 divide-y divide-line overflow-hidden rounded-[24px] bg-surface shadow-card">
              {[
                { k: "Услуга", v: `${sub?.name ?? ""} · ${d.title}`, s: "task" as Step },
                { k: "Описание", v: d.description, s: "details" as Step },
                { k: "Адрес", v: `${cityName}, ${d.address}${d.districtId ? ` · ${districts.find((x) => x.id === d.districtId)?.name} р-н` : ""}`, s: "where" as Step },
                { k: "Когда", v: `${d.urgency ? URGENCY[d.urgency].label : ""}${d.budget ? ` · бюджет ${rub(Number(d.budget))}` : ""}`, s: "when" as Step },
              ].map((row) => (
                <div key={row.k} className="flex items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <dt className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{row.k}</dt>
                    <dd className="mt-0.5 line-clamp-3 whitespace-pre-line text-[15px]">{row.v}</dd>
                  </div>
                  <button onClick={() => go(row.s)} className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Изменить: ${row.k}`}>
                    <Pencil className="h-4 w-4 text-muted" />
                  </button>
                </div>
              ))}
              {d.photos.length > 0 && (
                <div className="flex gap-2 px-5 py-4">
                  {d.photos.map((p) => (
                    <img key={p} src={p} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ))}
                </div>
              )}
            </dl>
            <Input className="mt-4" label="Телефон для связи" optional type="tel" inputMode="tel" value={d.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} hint="Покажем только выбранному исполнителю" />
            <p className="mt-4 px-1 text-[13px] text-muted">
              {provider ? `Заявку получит ${provider.displayName}. Если он не сможет, мы предложим её другим специалистам.` : "Заявку получат подходящие исполнители рядом. Отклики придут в приложение и Telegram."}
            </p>
          </section>
        )}
      </div>

      {step !== "what" && step !== "task" && !nativeButton && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,var(--safe-bottom))] pt-3 lg:static lg:mt-8 lg:p-0">
          <div className="mx-auto max-w-2xl">
            <Button size="lg" block variant={step === "review" ? "accent" : "primary"} onClick={next} loading={busy} className="shadow-float lg:shadow-none">
              {cta}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
