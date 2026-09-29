"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSession } from "./session-provider";
import { useTelegram } from "../telegram/telegram-provider";
import { NAV, isActive } from "./nav-items";

const HIDE_ON = [/^\/provider\//, /^\/order\/new/, /^\/messages\/.+/, /^\/admin/, /^\/login/, /^\/become-provider/, /^\/pay\//];

/** Floating glass tab bar for phones & tablets (and inside Telegram). */
export function BottomNav() {
  const pathname = usePathname();
  const { user, counts } = useSession();
  const { haptic } = useTelegram();
  if (HIDE_ON.some((r) => r.test(pathname))) return null;
  const second = user?.provider ? NAV.pro : NAV.search;
  const items = [NAV.home, second, null, NAV.messages, NAV.profile] as const;

  return (
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,var(--safe-bottom))] lg:hidden">
      <div className="glass mx-auto flex h-[66px] max-w-[520px] items-center justify-between rounded-[26px] px-2 shadow-float">
        {items.map((it, i) =>
          it === null ? (
            <Link
              key="create"
              href="/order/new"
              onClick={() => haptic("medium")}
              className="press -mt-0.5 inline-flex h-[50px] w-[58px] items-center justify-center rounded-[20px] bg-accent text-accent-ink shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--accent)_90%,transparent)]"
              aria-label="Создать заявку"
            >
              <Plus className="h-6 w-6" strokeWidth={2.4} />
            </Link>
          ) : (
            <Link
              key={it.href + i}
              href={it.href}
              onClick={() => haptic("select")}
              aria-current={isActive(pathname, it.href) ? "page" : undefined}
              className={cn("press relative flex h-[54px] min-w-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10.5px] font-semibold", isActive(pathname, it.href) ? "text-ink" : "text-muted")}
            >
              <it.icon className="h-[22px] w-[22px]" strokeWidth={isActive(pathname, it.href) ? 2.3 : 1.8} aria-hidden />
              {it.label}
              {it.href === "/messages" && counts.unreadMessages > 0 && (
                <span className="absolute right-[calc(50%-20px)] top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] leading-[18px] text-accent-ink tabular">{counts.unreadMessages > 99 ? "99+" : counts.unreadMessages}</span>
              )}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
