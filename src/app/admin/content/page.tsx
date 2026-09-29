import { pageAdmin } from "@/server/auth/session";
import { allContent } from "@/server/services/account";
import { AdminForm } from "@/components/admin/admin-form";
import { AdminPage } from "@/components/admin/table";

export default async function AdminContent() {
  const me = await pageAdmin();
  const blocks = await allContent();
  return (
    <AdminPage title="Контент" subtitle="Тексты на главной и FAQ поддержки">
      <div className="flex flex-col gap-3">
        {blocks.map((b) => (
          <section key={b.key} className="rounded-[22px] bezel p-5">
            <p className="mb-3 font-mono text-[12.5px] text-muted">{b.key}</p>
            {me.role === "admin" ? (
              <AdminForm
                type="content.update"
                fixed={{ key: b.key }}
                initial={{ title: b.title, body: b.body, isActive: b.isActive }}
                resetOnSuccess={false}
                className="flex flex-col gap-3"
                fields={[
                  { name: "title", label: "Заголовок", required: true },
                  { name: "body", label: "Текст", kind: "textarea" },
                  { name: "isActive", label: "Опубликовано", kind: "switch" },
                ]}
              />
            ) : (
              <>
                <p className="font-semibold">{b.title}</p>
                <p className="text-[14px] text-muted">{b.body}</p>
              </>
            )}
          </section>
        ))}
        {me.role === "admin" && (
          <section className="rounded-[22px] border border-dashed border-line-strong p-5">
            <p className="mb-3 text-[14px] font-semibold">Новый блок (например, faq.refund)</p>
            <AdminForm
              type="content.update"
              className="flex flex-col gap-3"
              fields={[
                { name: "key", label: "Ключ", placeholder: "faq.refund", required: true },
                { name: "title", label: "Заголовок", required: true },
                { name: "body", label: "Текст", kind: "textarea" },
                { name: "isActive", label: "Опубликовано", kind: "switch" },
              ]}
              initial={{ isActive: true }}
              submitLabel="Создать"
            />
          </section>
        )}
      </div>
    </AdminPage>
  );
}
