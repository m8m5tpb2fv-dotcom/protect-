import { BadgeCheck, Building2, Medal } from "lucide-react";
import { VERIFICATION } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Platform verification marker. It is a moderation status of the platform, not a legal guarantee. */
export function VerifiedMark({ level, size = 16, withLabel, className }: { level: "none" | "verified" | "pro" | "business"; size?: number; withLabel?: boolean; className?: string }) {
  const v = VERIFICATION[level];
  if (!v) return null;
  const Icon = level === "business" ? Building2 : level === "pro" ? Medal : BadgeCheck;
  return (
    <span className={cn("inline-flex items-center gap-1 text-ink", className)} title={v.label}>
      <span className={cn("inline-flex items-center justify-center rounded-full", level === "pro" ? "bg-accent text-accent-ink" : "bg-ink text-bg")} style={{ width: size + 4, height: size + 4 }}>
        <Icon aria-hidden style={{ width: size - 3, height: size - 3 }} strokeWidth={2.4} />
      </span>
      {withLabel ? <span className="text-[13px] font-medium">{v.label}</span> : <span className="sr-only">{v.label}</span>}
    </span>
  );
}
