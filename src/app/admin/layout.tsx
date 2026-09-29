import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { providers, reports, supportTickets } from "@/server/db/schema";
import { LogoMark } from "@/components/layout/logo";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Админ-панель", template: "%s · Админ" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role === "user") redirect("/");
  const [[pend], [rep], [tix]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(providers).where(eq(providers.status, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "open")),
    db.select({ n: sql<number>`count(*)::int` }).from(supportTickets).where(eq(supportTickets.status, "open")),
  ]);
  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-16 pt-[calc(var(--safe-top)+12px)] lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:px-6 lg:pt-6">
      <aside className="lg:sticky lg:top-6 lg:h-[calc(100dvh-48px)]">
        <div className="mb-4 flex items-center justify-between lg:mb-6">
          <Link href="/admin" className="flex items-center gap-2.5 font-bold tracking-[-0.03em]">
            <LogoMark size={30} /> Админ-панель
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> На сайт
          </Link>
        </div>
        <AdminNav badges={{ "/admin/providers": pend.n, "/admin/reports": rep.n, "/admin/tickets": tix.n }} />
        <p className="mt-4 hidden text-[12px] text-muted lg:block">
          {user.name} · {user.role === "admin" ? "администратор" : "модератор"}
        </p>
      </aside>
      <main className="mt-4 min-w-0 lg:mt-0">{children}</main>
    </div>
  );
}
