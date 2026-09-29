import Link from "next/link";
import { APP } from "@/config/app";
import { cn } from "@/lib/cn";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="10" fill="var(--accent)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent-ink)" strokeOpacity="0.22" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="4.4" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("press inline-flex items-center gap-2.5 rounded-xl", className)} aria-label={`${APP.name} — на главную`}>
      <LogoMark />
      {!compact && <span className="text-[19px] font-bold tracking-[-0.04em]">{APP.name}</span>}
    </Link>
  );
}
