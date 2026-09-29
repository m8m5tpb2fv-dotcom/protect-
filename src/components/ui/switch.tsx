"use client";
import { cn } from "@/lib/cn";

export function Switch({ checked, onChange, label, description, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean; className?: string }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-4", disabled && "opacity-50", className)}>
      <span className="flex flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        {description && <span className="text-[13px] text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-300", checked ? "bg-ink" : "bg-surface-3")}
      >
        <span className={cn("absolute top-[3px] h-6 w-6 rounded-full shadow-soft transition-all duration-300 ease-[var(--ease-spring)]", checked ? "left-[23px] bg-accent" : "left-[3px] bg-surface")} />
      </button>
    </label>
  );
}
