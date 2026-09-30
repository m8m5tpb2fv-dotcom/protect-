import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, BellRing, CheckCircle2, CreditCard, MessageCircle, ShieldCheck, Sparkles, Star, UserCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { listNotifications } from "@/server/services/account";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty";
import { relative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Уведомления", robots: { index: false } };

const ICONS: Record<string, typeof Bell> = {
  "order.new": Sparkles,
  "order.response": BellRing,
  "order.assigned": UserCheck,
  "order.status": CheckCircle2,
  "message.new": MessageCircle,
  "review.new": Star,
  "provider.moderation": ShieldCheck,
  payment: CreditCard,
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/notifications");
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 lg:pt-8">
      <PageHeader title="Уведомления" subtitle={unread ? `${unread} новых` : "Все прочитаны"} action={unread ? <MarkRead /> : null} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="Пока тихо" text="Здесь появятся отклики, сообщения и изменения статусов заказов." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const inner = (
              <div className={cn("flex gap-3 rounded-[22px] p-4", n.readAt ? "bg-surface/60" : "bezel")}>
                <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", n.readAt ? "bg-surface-2" : "bg-accent text-accent-ink")}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("text-[15px]", n.readAt ? "font-medium" : "font-semibold")}>{n.title}</p>
                    <span className="shrink-0 text-[12px] text-muted">{relative(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-[14px] text-muted">{n.body}</p>}
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="press block">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </main>
  );
}
