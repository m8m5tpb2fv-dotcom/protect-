import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent text-accent-ink",
  soft: "bg-accent-soft text-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  ink: "bg-ink text-bg",
  glass: "glass text-ink",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className, dot }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold tracking-[-0.005em]", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function StatusDot({ online, className }: { online: boolean; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", online ? "bg-success animate-pulse-dot" : "bg-muted/60", className)} aria-hidden />;
}
