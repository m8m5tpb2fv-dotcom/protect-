import Link from "next/link";
import { APP } from "@/config/app";
import { cn } from "@/lib/cn";
import { brandGlyph } from "@/lib/brand";

/** «Р-метка» on the accent tile. Colours follow the theme tokens (see src/lib/brand.ts for the geometry). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="10" fill="var(--accent)" />
      <g dangerouslySetInnerHTML={{ __html: brandGlyph("var(--accent-ink)") }} />
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
