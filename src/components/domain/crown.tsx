import { cn } from "@/lib/cn";

/** 👑 next to a provider's name — shown while their «Продвижение» subscription is active. */
export function Crown({ show, size = 16, className }: { show: boolean; size?: number; className?: string }) {
  if (!show) return null;
  return (
    <span role="img" aria-label="Продвижение" title="Продвижение" className={cn("shrink-0 leading-none", className)} style={{ fontSize: size }}>
      👑
    </span>
  );
}
