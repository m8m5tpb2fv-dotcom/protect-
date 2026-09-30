"use client";
import { Share2 } from "lucide-react";
import { useToast } from "../ui/toast";
import { useTelegram } from "../telegram/telegram-provider";
import { cn } from "@/lib/cn";

/** Native share sheet → Telegram share → clipboard fallback. */
export function ShareButton({ title, path, tgLink, className }: { title: string; path: string; tgLink?: string | null; className?: string }) {
  const toast = useToast();
  const { webApp } = useTelegram();
  return (
    <button
      type="button"
      aria-label="Поделиться"
      className={cn("press glass inline-flex h-10 w-10 items-center justify-center rounded-full", className)}
      onClick={async () => {
        const url = tgLink && webApp ? tgLink : new URL(path, window.location.origin).toString();
        if (webApp) return webApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {}
          return;
        }
        await navigator.clipboard.writeText(url).catch(() => {});
        toast("Ссылка скопирована", "info");
      }}
    >
      <Share2 className="h-[18px] w-[18px]" />
    </button>
  );
}
