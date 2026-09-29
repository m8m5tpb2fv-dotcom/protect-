import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, ChevronRight, ClipboardList, Heart, LifeBuoy, Settings, Shield, Bell, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeSwitch } from "@/components/domain/theme-switch";
import { LogoutButton } from "@/components/domain/logout-button";
import { formatPhone } from "@/lib/phone";
import { dateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Профиль", robots: { index: false } };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");
  const p = user.provider;
  const items = [
    { href: "/orders", icon: ClipboardList, label: "Мои заказы" },
    { href: "/favorites", icon: Heart, label: "Избранное" },
    { href: "/notifications", icon: Bell, label: "Уведомления" },
    { href: "/settings", icon: Settings, label: "Настройки" },
    { href: "/support", icon: LifeBuoy, label: "Поддержка" },
    ...(user.role !== "user" ? [{ href: "/admin", icon: Shield, label: "Админ-панель" }] : []),
  ];
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 lg:pt-8">
      <section className="flex items-center gap-4 rounded-[28px] bg-surface p-5 shadow-card">
        <Avatar name={user.name} src={user.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="title truncate text-[24px]">{user.name}</h1>
          <p className="truncate text-[14px] text-muted">{user.email ?? formatPhone(user.phone) ?? (user.telegramUsername ? `@${user.telegramUsername}` : "")}</p>
          <p className="mt-1 text-[12.5px] text-muted">С нами с {dateShort(user.createdAt)}</p>
        </div>
        <Link href="/settings" className="press inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2" aria-label="Настройки">
          <Settings className="h-5 w-5" />
        </Link>
      </section>

      {p ? (
        <Link href="/pro" className="press lift mt-3 flex items-center gap-4 rounded-[28px] bg-ink p-5 text-bg">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <BriefcaseBusiness className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block text-[17px] font-semibold">Кабинет исполнителя</span>
            <span className="block text-[13.5px] opacity-70">{p.displayName}</span>
          </span>
          {p.status === "pending" ? <Badge tone="warning">На проверке</Badge> : p.status === "rejected" ? <Badge tone="danger">Нужны правки</Badge> : <ChevronRight className="h-5 w-5 opacity-60" />}
        </Link>
      ) : (
        <Link href="/become-provider" className="press lift mt-3 flex items-center gap-4 rounded-[28px] bg-accent p-5 text-accent-ink">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/50">
            <Sparkles className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block text-[17px] font-semibold">Стать исполнителем</span>
            <span className="block text-[13.5px] opacity-75">Получайте заказы от клиентов рядом</span>
          </span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}

      <nav className="mt-3 rounded-[28px] bg-surface p-2 shadow-card" aria-label="Меню профиля">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="press flex min-h-14 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium hover:bg-surface-2">
            <it.icon className="h-5 w-5 text-ink-2" />
            <span className="flex-1">{it.label}</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
        ))}
        <LogoutButton />
      </nav>

      <section className="mt-3 rounded-[28px] bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-[15px] font-semibold">Оформление</h2>
        <ThemeSwitch />
      </section>
    </main>
  );
}
