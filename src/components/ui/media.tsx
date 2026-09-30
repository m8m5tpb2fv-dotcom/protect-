/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";

/** Image with reserved aspect ratio (no CLS) and lazy loading. Works for uploads (/files) and generated art (/art). */
export function Media({ src, alt, ratio, className, priority, sizes }: { src: string; alt: string; ratio?: number; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)} style={ratio ? { aspectRatio: String(ratio) } : undefined}>
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
