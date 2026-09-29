import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { rating as fmt } from "@/lib/format";

export function RatingInline({ value, count, className, size = 14 }: { value: number; count?: number; className?: string; size?: number }) {
  if (!count && !value) return <span className={cn("text-[13px] text-muted", className)}>Новый</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular font-semibold", className)} aria-label={`Рейтинг ${fmt(value)} из 5${count ? `, отзывов: ${count}` : ""}`}>
      <Star aria-hidden className="fill-current" style={{ width: size, height: size }} strokeWidth={0} />
      {fmt(value)}
      {count != null && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}

export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${value} из 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden style={{ width: size, height: size }} strokeWidth={0} className={i <= Math.round(value) ? "fill-ink" : "fill-line-strong"} />
      ))}
    </span>
  );
}
