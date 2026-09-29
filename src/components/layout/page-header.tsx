"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useTelegram } from "../telegram/telegram-provider";

/** Title bar for nested screens. Inside Telegram the native BackButton is used instead of ours. */
export function PageHeader({ title, subtitle, back = true, backHref, action, className, sticky = true }: { title?: ReactNode; subtitle?: ReactNode; back?: boolean; backHref?: string; action?: ReactNode; className?: string; sticky?: boolean }) {
  const router = useRouter();
  const { isTelegram } = useTelegram();
  const showBack = back && !isTelegram;
  if (!title && !subtitle && !action && !showBack) return <div aria-hidden className="h-[var(--safe-top)] lg:hidden" />;
  return (
    <div className={cn("z-30 -mx-4 mb-2 px-4 pb-2 pt-[calc(var(--safe-top)+8px)] lg:static lg:mx-0 lg:px-0 lg:pt-2", sticky && "sticky top-0 bg-bg/85 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none", className)}>
      <div className="flex min-h-11 items-center gap-2">
        {showBack && (
          <button
            onClick={() => (backHref ? router.push(backHref) : window.history.length > 1 ? router.back() : router.push("/"))}
            className="press -ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-2 lg:hidden"
            aria-label="Назад"
          >
            <ArrowLeft className="h-[22px] w-[22px]" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {title && <h1 className="title truncate text-[20px] lg:text-[30px]">{title}</h1>}
          {subtitle && <p className="truncate text-[13px] text-muted lg:text-[15px]">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
