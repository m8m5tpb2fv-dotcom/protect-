"use client";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useSession } from "../layout/session-provider";
import { useTelegram } from "../telegram/telegram-provider";
import { useToast } from "../ui/toast";

export function FavoriteButton({ providerId, initial, className, variant = "glass" }: { providerId: string; initial: boolean; className?: string; variant?: "glass" | "plain" }) {
  const [fav, setFav] = useState(initial);
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { haptic } = useTelegram();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? "Убрать из избранного" : "Добавить в избранное"}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        const prev = fav;
        setFav(!prev);
        haptic("light");
        try {
          const r = await api<{ favorite: boolean }>(`/api/favorites/${providerId}`, { method: "POST" });
          setFav(r.favorite);
          toast(r.favorite ? "Добавлено в избранное" : "Убрано из избранного", "info");
        } catch (err) {
          setFav(prev);
          toast((err as Error).message, "error");
        }
      }}
      className={cn("press inline-flex h-10 w-10 items-center justify-center rounded-full", variant === "glass" ? "glass" : "hover:bg-surface-2", className)}
    >
      <Heart className={cn("h-[18px] w-[18px] transition-transform", fav && "scale-110 fill-danger text-danger")} strokeWidth={2} />
    </button>
  );
}
