import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { listFavorites } from "@/server/services/providers";
import { PageHeader } from "@/components/layout/page-header";
import { ProviderCard } from "@/components/domain/provider-card";
import { EmptyState } from "@/components/ui/empty";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Избранное", robots: { index: false } };

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favorites");
  const items = await listFavorites(user.id);
  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-32 lg:px-6 lg:pt-8">
      <PageHeader title="Избранное" subtitle={items.length ? `${items.length} исполнителей` : undefined} />
      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Здесь пока пусто" text="Добавляйте понравившихся исполнителей, чтобы быстро вернуться к ним." action={<Link href="/search" className={buttonClass({ variant: "primary" })}>Найти специалиста</Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p) => (
            <ProviderCard key={p.id} p={p} favorite actions />
          ))}
        </div>
      )}
    </main>
  );
}
