"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { rub } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { ListPlus } from "lucide-react";

type Svc = { id: string; title: string; description: string; priceFrom: number; priceTo: number | null; unit: string; serviceId: number | null };
type Form = { id?: string; title: string; description: string; priceFrom: string; priceTo: string; unit: string; serviceId: number | null };
const EMPTY: Form = { title: "", description: "", priceFrom: "", priceTo: "", unit: "за услугу", serviceId: null };

export function ServicesEditor({ initial, suggestions }: { initial: Svc[]; suggestions: { id: number; name: string; priceFrom: number | null; unit: string | null }[] }) {
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const body = { title: form.title, description: form.description, priceFrom: Number(form.priceFrom || 0), priceTo: form.priceTo ? Number(form.priceTo) : null, unit: form.unit || "за услугу", serviceId: form.serviceId };
      await api(form.id ? `/api/provider/services/${form.id}` : "/api/provider/services", { method: form.id ? "PUT" : "POST", body });
      toast("Сохранено");
      setForm(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="title text-[22px]">Услуги и цены</h2>
        <Button onClick={() => setForm(EMPTY)}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>
      {initial.length === 0 ? (
        <EmptyState icon={ListPlus} title="Добавьте услуги" text="Профили с прайсом получают больше заказов: клиентам проще выбрать." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[24px] bg-surface shadow-card">
          {initial.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] font-semibold">{s.title}</p>
                <p className="text-[13.5px] text-muted">
                  {s.priceTo ? `${s.priceFrom.toLocaleString("ru-RU")}–${rub(s.priceTo)}` : `от ${rub(s.priceFrom)}`} · {s.unit}
                </p>
              </div>
              <button className="press inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Изменить" onClick={() => setForm({ id: s.id, title: s.title, description: s.description, priceFrom: String(s.priceFrom), priceTo: s.priceTo ? String(s.priceTo) : "", unit: s.unit, serviceId: s.serviceId })}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="press inline-flex h-10 w-10 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
                aria-label="Удалить"
                onClick={async () => {
                  if (!confirm(`Удалить «${s.title}»?`)) return;
                  await api(`/api/provider/services/${s.id}`, { method: "DELETE" }).catch((e) => toast(e.message, "error"));
                  router.refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <section>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Популярное в вашей специализации</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.id} onClick={() => setForm({ ...EMPTY, title: s.name, priceFrom: s.priceFrom ? String(s.priceFrom) : "", unit: s.unit ?? "за услугу", serviceId: s.id })} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[14px] font-medium shadow-soft ring-1 ring-line">
                <Plus className="h-4 w-4" /> {s.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? "Изменить услугу" : "Новая услуга"} footer={<Button block size="lg" loading={busy} onClick={save}>Сохранить</Button>}>
        {form && (
          <div className="flex flex-col gap-4">
            <Input label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Цена от, ₽" inputMode="numeric" value={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: e.target.value.replace(/\D/g, "") })} />
              <Input label="до, ₽" optional inputMode="numeric" value={form.priceTo} onChange={(e) => setForm({ ...form, priceTo: e.target.value.replace(/\D/g, "") })} />
            </div>
            <Input label="Единица" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="за час, за м², за выезд" maxLength={40} />
            <Textarea label="Описание" optional rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
