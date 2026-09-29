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
    <nav aria-label="Основная навигация" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,var(--safe-bottom))] lg:hidden">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b0b0c]/85 p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-2xl">
        {items.map((it, i) =>
          it === null ? (
            <Link
              key="create"
              href="/order/new"
              onClick={() => haptic("medium")}
              className="press glow mx-1 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-accent-ink"
              aria-label="Создать заявку"
            >
              <Plus className="h-6 w-6" strokeWidth={2.4} />
            </Link>
          ) : (
            <Link
              key={it.href + i}
              href={it.href}
              onClick={() => haptic("select")}
              aria-label={it.label}
              title={it.label}
              aria-current={isActive(pathname, it.href) ? "page" : undefined}
              className={cn(
                "press relative inline-flex h-[52px] w-[52px] items-center justify-center rounded-full transition-colors",
                isActive(pathname, it.href) ? "bg-white text-black" : "bg-white/[0.07] text-white/70 hover:text-white",
              )}
            >
              <it.icon className="h-[21px] w-[21px]" strokeWidth={isActive(pathname, it.href) ? 2.3 : 1.9} aria-hidden />
              {it.href === "/messages" && counts.unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-[18px] text-accent-ink tabular">{counts.unreadMessages > 99 ? "99+" : counts.unreadMessages}</span>
              )}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
