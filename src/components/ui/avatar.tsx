/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONES = ["#E9DCC6", "#D6E2D3", "#D8DDE8", "#EBD6D8", "#DEDAF0", "#E5EDC8", "#D3E6EA", "#F0DCCB"];
const TONES_INK = ["#5B4221", "#2E4A33", "#2F3A55", "#5C2B33", "#3A3266", "#3E4F14", "#1F4750", "#5E3313"];

function toneIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % TONES.length;
}

export function Avatar({ src, name, size = 44, className, ring }: { src?: string | null; name: string; size?: number; className?: string; ring?: boolean }) {
  const i = toneIndex(name);
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold", ring && "ring-[3px] ring-surface", className)}
      style={{ width: size, height: size, background: TONES[i], color: TONES_INK[i], fontSize: Math.max(11, size * 0.36), letterSpacing: "-0.02em" }}
      aria-hidden={!src}
    >
      {src ? <img src={src} alt={name} width={size} height={size} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : initials(name)}
    </span>
  );
}
