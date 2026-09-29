"use client";
/* eslint-disable @next/next/no-img-element */
import { Building2, Camera, Check, ImagePlus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError, uploadFile } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Avatar } from "../ui/avatar";
import { Button, Spinner } from "../ui/button";
import { Input, Select, Textarea } from "../ui/field";
import { Switch } from "../ui/switch";
import { useToast } from "../ui/toast";
import { CatalogIcon } from "../ui/catalog-icon";
import { useMainButton, useTelegram } from "../telegram/telegram-provider";

type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Schedule = Record<Day, { from: string; to: string } | null>;
export type ProviderFormValues = {
  displayName: string;
  kind: "person" | "company";
  headline: string;
  bio: string;
  primarySubcategoryId: number | null;
  subcategoryIds: number[];
  districtId: number | null;
  radiusKm: number;
  worksCityWide: boolean;
  experienceYears: number;
  priceFrom: string;
  phone: string;
  telegram: string;
  showPhone: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
  schedule: Schedule;
};
type Cat = { id: number; name: string; subs: { id: number; name: string; icon: string }[] };

const DAYS: [Day, string][] = [["mon", "Пн"], ["tue", "Вт"], ["wed", "Ср"], ["thu", "Чт"], ["fri", "Пт"], ["sat", "Сб"], ["sun", "Вс"]];
const STEPS = ["Специализация", "О себе", "География и цены", "Контакты"] as const;

export const DEFAULT_SCHEDULE: Schedule = { mon: { from: "09:00", to: "19:00" }, tue: { from: "09:00", to: "19:00" }, wed: { from: "09:00", to: "19:00" }, thu: { from: "09:00", to: "19:00" }, fri: { from: "09:00", to: "19:00" }, sat: { from: "10:00", to: "16:00" }, sun: null };

export function ProviderForm({ mode, initial, catalog, districts }: { mode: "create" | "edit"; initial: ProviderFormValues; catalog: Cat[]; districts: { id: number; name: string }[] }) {
  const [v, setV] = useState(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { haptic } = useTelegram();
  const set = (p: Partial<ProviderFormValues>) => setV((x) => ({ ...x, ...p }));
  const allSubs = catalog.flatMap((c) => c.subs);

  const check = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0 && !v.primarySubcategoryId) e.primarySubcategoryId = "Выберите основную специализацию";
    if (s === 1) {
      if (v.displayName.trim().length < 2) e.displayName = "Укажите имя или название";
      if (v.headline.trim().length < 5) e.headline = "Коротко: чем вы занимаетесь";
    }
    setErrors(e);
    if (Object.keys(e).length) haptic("error");
    return !Object.keys(e).length;
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length; s++) if (!check(s)) return setStep(mode === "create" ? s : step);
    setBusy(true);
    try {
      const payload = { ...v, priceFrom: v.priceFrom ? Number(v.priceFrom) : null, phone: v.phone || null, telegram: v.telegram || null, subcategoryIds: v.subcategoryIds.filter((i) => i !== v.primarySubcategoryId) };
      if (mode === "create") {
        await api("/api/provider", { body: payload });
        haptic("success");
        router.replace("/pro?welcome=1");
      } else {
        const r = await api<{ needsReview: boolean }>("/api/provider", { method: "PUT", body: payload });
        toast(r.needsReview ? "Сохранено. Изменения отправлены на проверку." : "Профиль сохранён");
      }
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) setErrors(Object.fromEntries((e.details as { path: string; message: string }[]).map((x) => [x.path, x.message])));
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!check(step)) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else submit();
  };
  const cta = mode === "edit" ? "Сохранить" : step < STEPS.length - 1 ? "Далее" : "Отправить на проверку";
  const native = useMainButton({ text: cta, onClick: mode === "edit" ? submit : next, loading: busy });

  const upload = async (kind: "avatar" | "cover", file: File) => {
    setUploading(kind);
    try {
      const r = await uploadFile(file, kind === "avatar" ? "avatar" : "cover");
      set(kind === "avatar" ? { avatarUrl: r.url } : { coverUrl: r.url });
    } catch (e) {
      toast(e instanceof ApiError && e.message.includes("исполнителя") ? "Обложку можно добавить после создания профиля" : (e as Error).message, "error");
    } finally {
      setUploading(null);
    }
  };

  const show = (s: number) => mode === "edit" || step === s;
  const section = "rounded-[28px] bg-surface p-5 shadow-card md:p-6";

  return (
    <div className="flex flex-col gap-4">
      {mode === "create" && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Шаги">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-ink" : "bg-surface-3")} />
              <span className={cn("hidden text-[12px] font-semibold sm:block", i === step ? "text-ink" : "text-muted")}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {show(0) && (
        <section className={section}>
          <h2 className="title text-[22px]">Специализация</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["person", "company"] as const).map((k) => (
              <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={v.kind === k} className={cn("press flex items-center gap-3 rounded-2xl p-4 text-left", v.kind === k ? "bg-ink text-bg" : "bg-surface-2")}>
                {k === "person" ? <UserRound className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                <span className="text-[15px] font-semibold">{k === "person" ? "Частный мастер" : "Компания"}</span>
              </button>
            ))}
          </div>
          <Select className="mt-4" label="Основная специализация" value={v.primarySubcategoryId ?? ""} onChange={(e) => set({ primarySubcategoryId: e.target.value ? Number(e.target.value) : null })} error={errors.primarySubcategoryId}>
            <option value="">Выберите…</option>
            {catalog.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {v.primarySubcategoryId && (
            <div className="mt-4">
              <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">
                Дополнительно <span className="font-normal text-muted">· до 4, из той же сферы</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(catalog.find((c) => c.subs.some((s) => s.id === v.primarySubcategoryId))?.subs ?? [])
                  .filter((s) => s.id !== v.primarySubcategoryId)
                  .map((s) => {
                    const on = v.subcategoryIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ subcategoryIds: on ? v.subcategoryIds.filter((i) => i !== s.id) : [...v.subcategoryIds, s.id].slice(0, 4) })}
                        className={cn("press inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-medium", on ? "bg-ink text-bg" : "bg-surface-2")}
                      >
                        <CatalogIcon name={s.icon} className="h-4 w-4" /> {s.name} {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
          {v.primarySubcategoryId && <p className="mt-3 px-1 text-[13px] text-muted">Выбрано: {allSubs.find((s) => s.id === v.primarySubcategoryId)?.name}</p>}
        </section>
      )}

      {show(1) && (
        <section className={section}>
          <h2 className="title text-[22px]">О себе</h2>
          <div className="mt-4 flex items-center gap-4">
            <button type="button" onClick={() => avatarRef.current?.click()} className="press relative rounded-full" aria-label="Загрузить фото">
              <Avatar name={v.displayName || "?"} src={v.avatarUrl} size={84} />
              <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg ring-4 ring-surface">{uploading === "avatar" ? <Spinner /> : <Camera className="h-4 w-4" />}</span>
            </button>
            <p className="text-[14px] text-muted">Живое фото повышает доверие: профили с фото получают в 2 раза больше заказов.</p>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => (e.target.files?.[0] && upload("avatar", e.target.files[0]), (e.target.value = ""))} />
          </div>
          <div className="mt-5 flex flex-col gap-4">
            <Input label={v.kind === "company" ? "Название компании" : "Имя и фамилия"} value={v.displayName} onChange={(e) => set({ displayName: e.target.value })} error={errors.displayName} maxLength={80} autoComplete="name" />
            <Input label="Коротко о себе" value={v.headline} onChange={(e) => set({ headline: e.target.value })} error={errors.headline} maxLength={120} placeholder="Сантехник. Протечки, смесители, засоры — в день обращения" hint={`${v.headline.length}/120`} />
            <Textarea label="Подробнее" optional rows={5} value={v.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={3000} placeholder="Опыт, инструменты, гарантия, как вы работаете" />
            <Input label="Опыт, лет" inputMode="numeric" value={String(v.experienceYears)} onChange={(e) => set({ experienceYears: Math.min(70, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
            {mode === "edit" && (
              <div>
                <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Обложка профиля</p>
                <button type="button" onClick={() => coverRef.current?.click()} className="press relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-[22px] border-2 border-dashed border-line-strong bg-surface-2 text-muted">
                  {v.coverUrl ? <img src={v.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                  <span className="glass relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-ink">
                    {uploading === "cover" ? <Spinner /> : <ImagePlus className="h-4 w-4" />} {v.coverUrl ? "Заменить" : "Загрузить"}
                  </span>
                </button>
                <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => (e.target.files?.[0] && upload("cover", e.target.files[0]), (e.target.value = ""))} />
              </div>
            )}
          </div>
        </section>
      )}

      {show(2) && (
        <section className={section}>
          <h2 className="title text-[22px]">География и цены</h2>
          <div className="mt-4 flex flex-col gap-4">
            <Select label="Район, где вы находитесь" value={v.districtId ?? ""} onChange={(e) => set({ districtId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Не указан</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Switch label="Работаю по всему городу" checked={v.worksCityWide} onChange={(x) => set({ worksCityWide: x })} />
            {!v.worksCityWide && (
              <div>
                <label htmlFor="radius" className="flex justify-between px-1 text-[13px] font-semibold text-ink-2">
                  Радиус выезда <span className="tabular">{v.radiusKm} км</span>
                </label>
                <input id="radius" type="range" min={1} max={50} value={v.radiusKm} onChange={(e) => set({ radiusKm: Number(e.target.value) })} className="mt-2 w-full accent-[var(--ink)]" />
              </div>
            )}
            <Input label="Цена от, ₽" inputMode="numeric" value={v.priceFrom} onChange={(e) => set({ priceFrom: e.target.value.replace(/\D/g, "").slice(0, 8) })} hint="Минимальная стоимость услуги — показывается в карточке" />
            <div>
              <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">График работы</p>
              <ul className="flex flex-col gap-1.5">
                {DAYS.map(([k, l]) => {
                  const d = v.schedule[k];
                  return (
                    <li key={k} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
                      <button type="button" onClick={() => set({ schedule: { ...v.schedule, [k]: d ? null : { from: "09:00", to: "19:00" } } })} aria-pressed={!!d} className={cn("press inline-flex h-9 w-12 items-center justify-center rounded-xl text-[13px] font-semibold", d ? "bg-ink text-bg" : "bg-surface text-muted")}>
                        {l}
                      </button>
                      {d ? (
                        <>
                          <input type="time" aria-label={`${l} с`} value={d.from} onChange={(e) => set({ schedule: { ...v.schedule, [k]: { ...d, from: e.target.value } } })} className="h-9 rounded-xl bg-surface px-2 text-[14px] tabular" />
                          <span className="text-muted">—</span>
                          <input type="time" aria-label={`${l} до`} value={d.to} onChange={(e) => set({ schedule: { ...v.schedule, [k]: { ...d, to: e.target.value } } })} className="h-9 rounded-xl bg-surface px-2 text-[14px] tabular" />
                        </>
                      ) : (
                        <span className="text-[14px] text-muted">Выходной</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {show(3) && (
        <section className={section}>
          <h2 className="title text-[22px]">Контакты</h2>
          <div className="mt-4 flex flex-col gap-4">
            <Input label="Телефон" type="tel" inputMode="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} placeholder="+7 900 000-00-00" />
            <Switch label="Показывать телефон в профиле" description="Иначе клиенты свяжутся через чат" checked={v.showPhone} onChange={(x) => set({ showPhone: x })} />
            <Input label="Telegram" value={v.telegram} onChange={(e) => set({ telegram: e.target.value })} error={errors.telegram} placeholder="@username" />
            {mode === "create" && <p className="rounded-2xl bg-surface-2 p-4 text-[14px] text-ink-2">После отправки профиль проверит модератор (обычно до 24 часов). Для статуса «Проверенный» загрузите документы в кабинете.</p>}
          </div>
        </section>
      )}

      {!native && (
        <div className="sticky bottom-[max(12px,var(--safe-bottom))] z-20 flex gap-2 lg:static">
          {mode === "create" && step > 0 && (
            <Button variant="surface" size="lg" onClick={() => setStep(step - 1)}>
              Назад
            </Button>
          )}
          <Button size="lg" block variant={mode === "create" && step === STEPS.length - 1 ? "accent" : "primary"} loading={busy} onClick={mode === "edit" ? submit : next} className="shadow-float lg:shadow-none">
            {cta}
          </Button>
        </div>
      )}
    </div>
  );
}
