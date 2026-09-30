import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Concave joint between a raised tab and the panel body (drawn in the panel colour via currentColor). */
export function TabJoint({ side, className }: { side: "left" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 20 14" aria-hidden className={cn("absolute bottom-0 h-[14px] w-[20px]", side === "right" ? "left-full" : "right-full -scale-x-100", className)}>
      <path d="M0 0C11 0 9 14 20 14H0Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Folder-shaped card (references: Workouts, Recording): a tab on the top-left,
 * a second sheet peeking behind on the right.
 */
export function Folder({ children, className, bodyClassName, tabWidth = "44%" }: { children: ReactNode; className?: string; bodyClassName?: string; tabWidth?: string }) {
  return (
    <div className={cn("relative pt-[13px] text-[var(--folder)] [--folder:var(--surface)]", className)}>
      {/* back sheet */}
      <span aria-hidden className="absolute right-0 top-[3px] h-8 w-[62%] rounded-t-[18px] bg-surface-3/70 dark:bg-[#26262a]" />
      {/* tab */}
      <span aria-hidden className="absolute left-0 top-0 h-8 rounded-tl-[18px] bg-[var(--folder)]" style={{ width: tabWidth }}>
        <TabJoint side="right" className="bottom-[19px]" />
      </span>
      <div className={cn("relative rounded-[24px] rounded-tl-none bg-[var(--folder)] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]", bodyClassName)}>{children}</div>
    </div>
  );
}
