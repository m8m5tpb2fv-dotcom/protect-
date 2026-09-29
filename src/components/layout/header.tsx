"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, MapPin, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "../ui/avatar";
import { buttonClass } from "../ui/button";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { useSession } from "./session-provider";
import { NAV, isActive } from "./nav-items";
import { CityPicker } from "./city-picker";

function Bell_({ className }: { className?: string }) {
  const { user, counts } = useSession();
  return (
    <Link href={user ? "/notifications" : "/login?next=/notifications"} className={cn("press relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2", className)} aria-label={`Уведомления${counts.unreadNotifications ? `, непрочитанных: ${counts.unreadNotifications}` : ""}`}>
      <Bell className="h-[21px] w-[21px]" strokeWidth={1.9} />
      {counts.unreadNotifications > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" aria-hidden />}
    </Link>
  );
}

function Me() {
  const { user } = useSession();
  if (!user)
    return (
      <Link href="/login" className={buttonClass({ variant: "secondary", size: "sm", className: "h-10 rounded-full px-4" })}>
        Войти
      </Link>
    );
  return (
    <Link href="/profile" className="press rounded-full" aria-label="Профиль">
      <Avatar name={user.name} src={user.avatarUrl} size={38} />
    </Link>
  );
}

/** Mobile top bar: city + notifications + avatar. Hidden on desktop and on nested pages that render their own header. */
export function MobileTopBar() {
  const pathname = usePathname();
  const { city } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const show = ["/", "/services", "/search", "/orders", "/messages", "/profile", "/favorites", "/notifications", "/pro"].some((p) => (p === "/" ? pathname === "/" : pathname === p));
  if (!show) return null;
  return (
    <>
      <header className={cn("sticky top-0 z-30 px-4 pt-[calc(var(--safe-top)+8px)] pb-2 transition-[background-color,box-shadow] lg:hidden", scrolled ? "glass border-x-0 border-t-0 shadow-soft" : "border-b border-transparent")}>
        <div className="mx-auto flex h-11 max-w-3xl items-center justify-between">
          <button onClick={() => setOpen(true)} className="press -ml-1 inline-flex h-11 items-center gap-1.5 rounded-full pl-1 pr-3 text-[15px] font-semibold hover:bg-surface-2" aria-label={`Город: ${city.name}. Изменить`}>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg">
              <MapPin className="h-4 w-4" strokeWidth={2.2} />
            </span>
            {city.name}
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
          <div className="flex items-center gap-1">
            <Bell_ />
            <Me />
          </div>
        </div>
      </header>
      <CityPicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Desktop: floating glass navigation bar (not a dashboard sidebar). */
export function DesktopHeader() {
  const pathname = usePathname();
  const { user, city, counts } = useSession();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/admin")) return null;
  const links = [NAV.home, { ...NAV.search, label: "Услуги" }, NAV.orders, NAV.messages, ...(user?.provider ? [NAV.pro] : [])];
  return (
    <>
      <header className="sticky top-0 z-40 hidden px-6 pt-4 lg:block">
        <div className="glass mx-auto flex h-16 max-w-[1320px] items-center gap-6 rounded-[22px] pl-4 pr-3 shadow-card">
          <Logo />
          <button onClick={() => setOpen(true)} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[14px] font-semibold hover:bg-surface-3">
            <MapPin className="h-4 w-4" />
            {city.name}
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>
          <nav aria-label="Основная навигация" className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={cn("press relative rounded-xl px-3.5 py-2 text-[14.5px] font-semibold", isActive(pathname, l.href) ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink")}
              >
                {l.label}
                {l.href === "/messages" && counts.unreadMessages > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] text-accent-ink tabular">{counts.unreadMessages}</span>}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/search" className="press hidden h-11 w-56 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] text-muted hover:bg-surface-3 xl:flex">
              <Search className="h-4 w-4" />
              Найти специалиста
            </Link>
            <Link href="/order/new" className={buttonClass({ variant: "accent", size: "md", className: "rounded-full" })}>
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Создать заявку
            </Link>
            <Bell_ />
            <Me />
          </div>
        </div>
      </header>
      <CityPicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}
