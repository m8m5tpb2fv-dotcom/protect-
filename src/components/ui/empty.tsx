import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({ icon: Icon, title, text, action, className }: { icon: LucideIcon; title: string; text?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center", className)}>
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
        <Icon className="h-6 w-6 text-ink-2" strokeWidth={1.75} />
      </span>
      <h3 className="title text-lg">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-[15px] text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

export function SectionHeader({ title, subtitle, action, className, as: As = "h2" }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <As className="title text-[22px] md:text-[26px]">{title}</As>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li" }) {
  return <As className={cn("rounded-[var(--radius-card)] bg-surface p-5 shadow-card md:p-6", className)}>{children}</As>;
}
