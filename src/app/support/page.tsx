import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { allContent, myTickets } from "@/server/services/account";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { dateShort } from "@/lib/format";
import { SupportForm } from "./support-form";

export const metadata: Metadata = { title: "Поддержка" };

export default async function SupportPage() {
  const user = await getCurrentUser();
  const [content, tickets] = await Promise.all([allContent(), user ? myTickets(user.id) : Promise.resolve([])]);
  const faq = content.filter((c) => c.key.startsWith("faq.") && c.isActive);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 lg:pt-8">
      <PageHeader title="Поддержка" />
      <section className="flex flex-col gap-2">
        {faq.map((f) => (
          <details key={f.key} className="group rounded-[22px] bezel p-5">
            <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">{f.title}</summary>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.body}</p>
          </details>
        ))}
      </section>
      <SupportForm needEmail={!user?.email} />
      {tickets.length > 0 && (
        <section className="mt-6">
          <h2 className="title mb-3 text-[20px]">Мои обращения</h2>
          <ul className="flex flex-col gap-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-[22px] bezel p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.subject}</p>
                  <Badge tone={t.status === "open" ? "warning" : "success"}>{t.status === "open" ? "В работе" : t.status === "answered" ? "Есть ответ" : "Закрыто"}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted">{dateShort(t.createdAt)}</p>
                {t.answer && <p className="mt-2 rounded-2xl bg-surface-2 p-3 text-[14px]">{t.answer}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
