"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, MapPin, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "../ui/avatar";
import { buttonClass } from "../ui/button";
import { cn } from "@/lib/cn";
import { Logo, LogoMark } from "./logo";
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
function greeting() {
  const h = Number(new Intl.DateTimeFormat("ru-RU", { hour: "numeric", hour12: false, timeZone: "Europe/Saratov" }).format(new Date()));
  return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

/** Mobile top bar: greeting pill with avatar + grouped round actions (reference: humbleteam). */
export function MobileTopBar() {
  const pathname = usePathname();
  const { city, user, counts } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const show = ["/", "/services", "/search", "/orders", "/messages", "/profile", "/favorites", "/notifications"].some((p) => (p === "/" ? pathname === "/" : pathname === p));
  if (!show) return null;
  const first = user?.name.split(" ")[0];
  return (
    <>
      <header className={cn("sticky top-0 z-30 px-3 pb-2 pt-[calc(var(--safe-top)+8px)] transition-[background-color] lg:hidden", scrolled && "bg-bg/70 backdrop-blur-xl")}>
        <div className="bezel mx-auto flex h-[56px] max-w-3xl items-center gap-2.5 rounded-full p-1.5 pr-1.5">
          <Link href={user ? "/profile" : "/login"} className="press shrink-0 rounded-full" aria-label={user ? "Профиль" : "Войти"}>
            {user ? (
              <Avatar name={user.name} src={user.avatarUrl} size={42} />
            ) : (
              <LogoMark size={42} className="rounded-full" />
            )}
          </Link>
          <p className="min-w-0 flex-1 truncate text-[14.5px] text-muted">
            {user ? (
              <>
                {greeting()}, <span className="font-semibold text-ink">{first}</span>
              </>
            ) : (
              <Link href="/login" className="font-semibold text-ink">
                Войти <span className="font-normal text-muted">· {city.name}</span>
              </Link>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 p-1">
            <button onClick={() => setOpen(true)} className="press inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold hover:bg-surface-3" aria-label={`Город: ${city.name}. Изменить`}>
              <MapPin className="h-4 w-4" /> {user ? <span className="hidden min-[400px]:inline">{city.name}</span> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
            </button>
            <span className="h-4 w-px bg-line-strong" aria-hidden />
            <Link href={user ? "/notifications" : "/login?next=/notifications"} className="press relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-3" aria-label={`Уведомления${counts.unreadNotifications ? `, непрочитанных: ${counts.unreadNotifications}` : ""}`}>
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
              {counts.unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface-2" aria-hidden />}
            </Link>
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
        <div className="glass mx-auto flex h-16 max-w-[1320px] items-center gap-6 rounded-full pl-3 pr-2 shadow-card">
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
                className={cn("press relative rounded-xl px-3.5 py-2 text-[14.5px] font-semibold", isActive(pathname, l.href) ? "bezel text-ink" : "text-ink-2 hover:text-ink")}
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
