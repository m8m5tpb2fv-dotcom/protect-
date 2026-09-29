"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, CreditCard, FileText, Flag, FolderTree, History, LifeBuoy, MapPinned, MessageSquareQuote, Tag, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Обзор", icon: BarChart3 },
  { href: "/admin/providers", label: "Исполнители", icon: UserCheck },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/orders", label: "Заказы", icon: ClipboardList },
  { href: "/admin/reviews", label: "Отзывы", icon: MessageSquareQuote },
  { href: "/admin/reports", label: "Жалобы", icon: Flag },
  { href: "/admin/tickets", label: "Обращения", icon: LifeBuoy },
  { href: "/admin/payments", label: "Платежи", icon: CreditCard },
  { href: "/admin/promo", label: "Промокоды", icon: Tag },
  { href: "/admin/categories", label: "Категории", icon: FolderTree },
  { href: "/admin/geo", label: "Города и районы", icon: MapPinned },
  { href: "/admin/content", label: "Контент", icon: FileText },
  { href: "/admin/audit", label: "Журнал", icon: History },
];

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Админ-навигация" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 no-scrollbar lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {NAV.map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("press flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[14px] font-medium", active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface")}>
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {badges[n.href] ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink tabular">{badges[n.href]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
