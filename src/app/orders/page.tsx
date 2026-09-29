import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { listClientOrders } from "@/server/services/orders";
import { OrderCard } from "@/components/domain/order-card";
import { EmptyState } from "@/components/ui/empty";
import { buttonClass } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";

export const metadata: Metadata = { title: "Мои заказы", robots: { index: false } };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const tab = (await searchParams).tab === "archive" ? "archive" : "active";
  const all = await listClientOrders(user.id);
  const active = all.filter((o) => !["completed", "cancelled"].includes(o.status) || (o.status === "completed" && !o.hasReview));
  const archive = all.filter((o) => !active.includes(o));
  const list = tab === "active" ? active : archive;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 lg:pt-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="display text-[36px] lg:text-[48px]">Мои заказы</h1>
        <Link href="/order/new" className={buttonClass({ variant: "accent", size: "md", className: "hidden rounded-full sm:inline-flex" })}>
          <Plus className="h-4 w-4" /> Новая заявка
        </Link>
      </div>
      <Segmented
        className="mt-5"
        value={tab}
        items={[
          { value: "active", label: "Активные", count: active.length, href: "/orders" },
          { value: "archive", label: "Архив", count: archive.length, href: "/orders?tab=archive" },
        ]}
      />
      <div className="mt-4 flex flex-col gap-3">
        {list.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={tab === "active" ? "Активных заказов нет" : "Архив пуст"}
            text="Опишите задачу — исполнители рядом предложат цену и время."
            action={
              <Link href="/order/new" className={buttonClass({ variant: "accent", size: "lg", className: "rounded-full" })}>
                Создать заявку
              </Link>
            }
          />
        ) : (
          list.map((o) => <OrderCard key={o.id} o={o} />)
        )}
      </div>
    </main>
  );
}
