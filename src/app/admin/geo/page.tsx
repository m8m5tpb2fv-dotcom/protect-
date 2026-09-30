import { pageAdmin } from "@/server/auth/session";
import { adminGeo } from "@/server/services/admin";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";

export default async function AdminGeo() {
  const me = await pageAdmin();
  const cities = await adminGeo();
  const isAdmin = me.role === "admin";
  return (
    <AdminPage title="Города и районы" subtitle="Город — отдельная сущность: новые города подключаются без изменения кода">
      <div className="flex flex-col gap-3">
        {cities.map((c) => (
          <section key={c.id} className="rounded-[22px] bezel p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[18px] font-semibold">{c.name}</h2>
              <span className="text-[13px] text-muted">{c.region}</span>
              <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Работает" : "Скоро"}</Badge>
              <span className="flex-1" />
              {isAdmin && <AdminAction payload={{ type: "city.toggle", id: c.id, isActive: !c.isActive }} label={c.isActive ? "Выключить" : "Запустить"} variant={c.isActive ? "ghost" : "accent"} confirmText={c.isActive ? undefined : `Запустить ${c.name}? Город станет доступен для выбора.`} />}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.districts.map((d) => (
                <span key={d.id} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium">
                  {d.name}
                </span>
              ))}
              {!c.districts.length && <span className="text-[13px] text-muted">Районов пока нет</span>}
            </div>
            {isAdmin && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] font-semibold">+ Добавить район</summary>
                <AdminForm
                  type="district.create"
                  fixed={{ cityId: c.id }}
                  className="mt-3 flex flex-wrap items-end gap-3"
                  fields={[
                    { name: "name", label: "Название", required: true },
                    { name: "slug", label: "URL", placeholder: "centralny", required: true },
                    { name: "lat", label: "Широта", kind: "number", required: true },
                    { name: "lng", label: "Долгота", kind: "number", required: true },
                  ]}
                  submitLabel="Добавить"
                />
              </details>
            )}
          </section>
        ))}
      </div>
    </AdminPage>
  );
}
