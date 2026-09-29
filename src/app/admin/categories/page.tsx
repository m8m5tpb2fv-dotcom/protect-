import { requireAdmin } from "@/server/auth/session";
import { adminCategories } from "@/server/services/admin";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminAction } from "@/components/admin/action-button";
import { AdminPage } from "@/components/admin/table";
import { CatalogIcon } from "@/components/ui/catalog-icon";
import { Badge } from "@/components/ui/badge";

export default async function AdminCategories() {
  const me = await requireAdmin();
  const cats = await adminCategories();
  const isAdmin = me.role === "admin";
  return (
    <AdminPage title="Категории" subtitle={`${cats.length} групп · ${cats.reduce((n, c) => n + c.subs.length, 0)} специализаций`}>
      <div className="grid gap-3 xl:grid-cols-2">
        {cats.map((c) => (
          <section key={c.id} className="rounded-[22px] bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
                <CatalogIcon name={c.icon} className="h-5 w-5" />
              </span>
              <h2 className="flex-1 text-[17px] font-semibold">{c.name}</h2>
              {!c.isActive && <Badge tone="danger">Скрыта</Badge>}
              {isAdmin && <AdminAction payload={{ type: "category.update", id: c.id, isActive: !c.isActive }} label={c.isActive ? "Скрыть" : "Показать"} variant="ghost" />}
            </div>
            {isAdmin && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-muted">Изменить название и описание</summary>
                <AdminForm type="category.update" fixed={{ id: c.id }} initial={{ name: c.name, description: c.description }} resetOnSuccess={false} fields={[{ name: "name", label: "Название" }, { name: "description", label: "Описание" }]} className="mt-3 flex flex-wrap items-end gap-3" />
              </details>
            )}
            <ul className="mt-3 divide-y divide-line text-[14px]">
              {c.subs.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <CatalogIcon name={s.icon} className="h-4 w-4 text-muted" />
                  <span className={s.isActive ? "flex-1" : "flex-1 text-muted line-through"}>{s.name}</span>
                  <span className="text-[12.5px] text-muted tabular">{s.providers} исп.</span>
                  {isAdmin && <AdminAction payload={{ type: "subcategory.toggle", id: s.id, isActive: !s.isActive }} label={s.isActive ? "Скрыть" : "Показать"} variant="ghost" />}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] font-semibold">+ Добавить специализацию</summary>
                <AdminForm
                  type="subcategory.create"
                  fixed={{ categoryId: c.id }}
                  className="mt-3 flex flex-wrap items-end gap-3"
                  fields={[
                    { name: "name", label: "Название", placeholder: "Сварщик", required: true },
                    { name: "namePlural", label: "Мн. число", placeholder: "Сварщики", required: true },
                    { name: "slug", label: "URL", placeholder: "svarshchik", required: true },
                    { name: "icon", label: "Иконка (lucide)", placeholder: "Flame", required: true },
                    { name: "keywords", label: "Ключевые слова" },
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
